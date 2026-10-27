import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startApp, ANSWERS } from './helpers.js';
import { answerQuestion, acceptRewrite } from '../src/chat.js';

const rules = JSON.parse(readFileSync(fileURLToPath(new URL('../seed/rules.json', import.meta.url)), 'utf8')).rules;
const allUrls = new Set(rules.flatMap((r) => [r.source?.url, r.apply?.url, ...(r.guide?.facts || []).map((f) => f.source?.url)]).filter(Boolean));
const ask = (message, extra = {}) => answerQuestion({ message, conversation: [], rules, ...extra });

test('a license question is answered from the DOR record with record links only', async () => {
  const r = await ask('Do I need a business license?');
  assert.equal(r.matched[0].id, 'dor');
  assert.equal(r.mode, 'grounded');
  assert.ok(r.links.length >= 1);
  for (const l of r.links) assert.ok(allUrls.has(l.url), `link not in records: ${l.url}`);
  assert.match(r.answer, /Not yet Approved/);
});

test('fee and timing questions quote the dated facts', async () => {
  const t = await ask('How long does the DOR business license take to process?');
  assert.match(t.answer, /10 business days/);
  assert.match(t.answer, /Checked 2026-10-26/);
  const f = await ask('How much does the contractor registration fee and bond cost?');
  assert.equal(f.matched[0].id, 'lni-contractor');
  assert.match(f.answer, /Checked 2026-10-26/);
});

test('a pending step is described as not confirmed and has no invented link', async () => {
  const r = await ask('Do I need a county health permit for my restaurant?');
  assert.equal(r.matched[0].id, 'health');
  assert.match(r.answer, /Pending verification/);
  const health = rules.find((x) => x.id === 'health');
  for (const l of r.links) assert.ok(allUrls.has(l.url));
  assert.equal(health.apply, null);
  assert.ok(!r.links.some((l) => l.label === 'Start this step'));
});

test('an unknown question returns the fallback with topics and no links', async () => {
  const r = await ask('What is the capital of France?');
  assert.equal(r.mode, 'fallback');
  assert.match(r.answer, /I don't have that in the current rules\/guides\. Try asking about/);
  assert.deepEqual(r.links, []);
});

test('chat never invents policy: every number in an answer appears in the records', async () => {
  const text = JSON.stringify(rules);
  for (const q of ['How long does it take?', 'What does the license cost?', 'new hire reporting deadline']) {
    const r = await ask(q, { conversation: [{ role: 'user', content: 'Tell me about the DOR business license' }] });
    for (const n of r.answer.match(/\d[\d,]*/g) || []) {
      if (/^\d{1,2}$/.test(n)) continue; // list numbering
      assert.ok(text.includes(n), `number ${n} not in records (question: ${q})`);
    }
  }
});

test('questions about subcontractors and new hires reach different records', async () => {
  assert.equal((await ask('can I hire subcontractors')).matched[0].id, 'ic');
  assert.equal((await ask('Do I need to report new hires?')).matched[0].id, 'dshs');
  assert.equal((await ask('how do I register an LLC')).matched[0].id, 'sos');
  assert.equal((await ask('What is workers compensation?')).matched[0].id, 'lni-wc');
});

test('a follow-up uses the previous question for context', async () => {
  const r = await answerQuestion({
    message: 'how long does it take?', rules,
    conversation: [{ role: 'user', content: 'Tell me about the business license' }, { role: 'assistant', content: 'x' }],
  });
  assert.equal(r.matched[0].id, 'dor');
});

test('an off-topic question after an on-topic one does not inherit the old topic', async () => {
  const r = await answerQuestion({
    message: 'What is the capital of France?', rules,
    conversation: [{ role: 'user', content: 'Tell me about the business license' }, { role: 'assistant', content: 'x' }],
  });
  assert.equal(r.mode, 'fallback');
});

test('"my next step" uses the saved checklist and says so when there is none', async () => {
  const none = await ask('What is my next step?');
  assert.match(none.answer, /No business is selected yet/);
  assert.doesNotMatch(none.answer, /not built|you have not/i);
  const checklist = { saved: true, items: [
    { id: 'sos', title: 'File your business entity', status: 'applies', verification: { status: 'checked' }, done: true, apply: { url: 'https://example.invalid' } },
    { id: 'dor', title: 'Apply for your license', status: 'applies', verification: { status: 'checked' }, done: false, apply: { label: 'Go', url: 'https://dor.wa.gov/x' } },
  ] };
  const r = await ask('what is my next step', { checklist });
  assert.match(r.answer, /Next step: Apply for your license/);
  assert.equal(r.links[0].url, 'https://dor.wa.gov/x');
});

test('an LLM rewrite is used only when it adds no links or numbers', async () => {
  const good = await ask('Do I need a business license?', { llm: async () => 'You may need a Washington business license. It is Source checked, not yet Approved.' });
  assert.equal(good.mode, 'llm');
  const badLink = await ask('Do I need a business license?', { llm: async () => 'Go to https://evil.example/now' });
  assert.equal(badLink.mode, 'grounded');
  const badNum = await ask('Do I need a business license?', { llm: async () => 'It costs $9999 and takes 3 days.' });
  assert.equal(badNum.mode, 'grounded');
  const broken = await ask('Do I need a business license?', { llm: async () => { throw new Error('down'); } });
  assert.equal(broken.mode, 'grounded');
  assert.equal(acceptRewrite('ok', 'ok', []), true);
});

let app;
before(async () => { app = await startApp(); });
after(() => app.stop());

test('POST /api/chat validates input and keeps at most 8 turns', async () => {
  assert.equal((await app.call('POST', '/api/chat', { message: '   ' })).status, 400);
  assert.equal((await app.call('POST', '/api/chat', { message: 'x'.repeat(501) })).status, 400);
  const conversation = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `turn ${i}` }));
  const r = await app.call('POST', '/api/chat', { message: 'Do I need a business license?', conversation });
  assert.equal(r.status, 200);
  assert.equal(r.body.matched[0].id, 'dor');
});

test('POST /api/chat uses the visitor checklist for "my next step"', async () => {
  const h = { 'x-visitor-id': 'visitor-chat-00001' };
  await app.call('POST', '/api/checklist', { answers: ANSWERS, label: '' }, h);
  const r = await app.call('POST', '/api/chat', { message: 'what is my next step' }, h);
  assert.match(r.body.answer, /Next step:/);
  const other = await app.call('POST', '/api/chat', { message: 'what is my next step' }, { 'x-visitor-id': 'visitor-chat-00002' });
  assert.match(other.body.answer, /No business is selected yet/);
});

test('broad "how do I start" questions get the ordered overview, not the fallback', async () => {
  for (const q of ['i dont anything about how to start can you tell me', 'how to start a business', 'where do I begin', "I'm new to this", 'list all steps']) {
    const r = await ask(q);
    assert.equal(r.mode, 'grounded', q);
    assert.match(r.answer, /1\. File your business entity/, q);
    assert.ok(r.links.every((l) => /^https:\/\//.test(l.url)), q);
  }
});

test('small typos still find the right step', async () => {
  const r = await ask('do I need a business lisence');
  assert.equal(r.matched[0].id, 'dor');
  const u = await ask('do i need unemployment insurance');
  assert.equal(u.matched[0].id, 'esd');
});

test('off-topic questions still get the fallback with suggestions', async () => {
  const r = await ask('what is the capital of france');
  assert.equal(r.mode, 'fallback');
  assert.ok(r.suggestions.length >= 2);
});

test('"guide me", thanks and goodbye get friendly answers, not the fallback', async () => {
  const g = await ask('guide me');
  assert.equal(g.mode, 'grounded');
  assert.match(g.answer, /1\. File your business entity/);
  assert.match((await ask('thanks!')).answer, /welcome/i);
  assert.match((await ask('bye')).answer, /good luck/i);
});

test('RAG mode sends only retrieved records and recent turns, and keeps the status line', async () => {
  let seen;
  const llm = async (args) => { seen = args; return 'You will usually apply for the Washington business license through the Department of Revenue. It helps to have your business details ready.'; };
  const r = await ask('Do I need a business license?', { llm, conversation: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'Hello' }] });
  assert.equal(r.mode, 'llm');
  assert.match(seen.user, /CONTEXT:/);
  assert.match(seen.user, /Apply for your Washington business license/);
  assert.equal(seen.history.length, 2);
  assert.match(r.answer, /Not yet Approved|Pending verification/);
  const overclaim = await ask('Do I need a business license?', { llm: async () => 'Your license is officially approved and guaranteed.' });
  assert.equal(overclaim.mode, 'grounded');
});

test('vague "how to do" reuses the step from earlier chat, grounded and LLM', async () => {
  const conversation = [{ role: 'user', content: 'Do I need a business license?' }, { role: 'assistant', content: 'Apply for your Washington business license.' }];
  for (const q of ['how to do', 'how?', 'steps', 'how do I do this', 'How to do it?']) {
    const r = await ask(q, { conversation });
    assert.notEqual(r.mode, 'fallback', q);
    assert.equal(r.matched[0].id, 'dor', q);
    assert.match(r.answer, /Steps:/, q);
    assert.ok(r.links.every((l) => /^https:\/\//.test(l.url)), q);
  }
  let seen;
  const llm = async (a) => { seen = a; return 'First sign in to My DOR, then follow the application. Confirm with the agency.'; };
  const r = await ask('how to do', { conversation, llm });
  assert.equal(r.mode, 'llm');
  assert.equal(r.matched[0].id, 'dor');
  assert.match(seen.user, /Explain its steps/);
  const bad = await ask('how to do', { conversation, llm: async () => 'It costs $777. See https://evil.example' });
  assert.equal(bad.mode, 'grounded');
  assert.equal(bad.matched[0].id, 'dor');
});

test('vague "how to do" uses the next undone checklist step when there is no chat topic', async () => {
  const checklist = { saved: true, items: [{ id: 'sos', title: 'x', done: true }, { id: 'dor', title: 'y', done: false, status: 'applies' }] };
  const r = await ask('how to do', { checklist });
  assert.equal(r.matched[0].id, 'dor');
  assert.notEqual(r.mode, 'fallback');
});

test('vague "how to do" with no context gives the safe start overview, never invented content', async () => {
  for (const q of ['how to do', 'how?', 'steps']) {
    const r = await ask(q);
    assert.equal(r.mode, 'grounded', q);
    assert.match(r.answer, /1\. File your business entity/, q);
  }
});

test('earlier good questions still behave', async () => {
  assert.equal((await ask('Do I need a business license?')).matched[0].id, 'dor');
  assert.match((await ask('guide me')).answer, /1\. File your business entity/);
  const c = { saved: true, items: [{ id: 'dor', title: 'Apply for your Washington business license', done: false, status: 'applies', apply: { url: 'https://dor.wa.gov/x' } }] };
  assert.match((await ask('What is my next step?', { checklist: c })).answer, /Next step/);
  assert.equal((await ask('what is the capital of france', { conversation: [{ role: 'user', content: 'Do I need a business license?' }] })).mode, 'fallback');
});

// ---- Next-step follow-ups on the restaurant LLC with employees scenario (real API, real rules engine) ----
import { SAMPLES } from '../src/samples.js';
const RESTAURANT = SAMPLES.find((s) => s.id === 'restaurant');

async function restaurantVisitor(app, id) {
  const h = { 'x-visitor-id': id };
  await app.call('POST', '/api/checklist', { answers: RESTAURANT.answers, label: '' }, h);
  const chat = (message, conversation = []) => app.call('POST', '/api/chat', { message, conversation }, h).then((r) => r.body);
  const done = (ruleId, d = true) => app.call('PATCH', '/api/checklist/done', { ruleId, done: d }, h);
  const list = () => app.call('GET', '/api/checklist', null, h).then((r) => r.body);
  return { h, chat, done, list };
}

test('restaurant: "after getting the license what is the next step" answers directly, not the whole list', async () => {
  const v = await restaurantVisitor(app, 'visitor-rest-0001');
  const r = await v.chat('after getting the license what is the next step');
  assert.ok(r.answer.split('\n').length <= 9, r.answer);
  assert.doesNotMatch(r.answer, /Your checklist has \d+ steps/);
  assert.match(r.answer, /^After "Apply for your Washington business license"/);
  assert.match(r.answer, /Next step: /);
  assert.ok(!/Next step: Apply for your Washington business license/.test(r.answer));
  assert.match(r.answer, /show my full checklist/i);
  for (const l of r.links) assert.ok(allUrls.has(l.url), l.url);
});

test('restaurant: completed tasks are skipped when finding the next step', async () => {
  const v = await restaurantVisitor(app, 'visitor-rest-0002');
  const before = await v.chat('what is my next step');
  const firstTitle = /Next step: (.+?)\. \(/.exec(before.answer)[1];
  const cl = await v.list();
  const first = cl.items.find((i) => i.title === firstTitle);
  await v.done(first.id);
  const after = await v.chat('what is my next step');
  assert.ok(!after.answer.includes(`Next step: ${firstTitle}`));
  assert.doesNotMatch(after.answer, /Your checklist has/);
  // mark everything up to and including the license as done, then ask after the license
  for (const i of cl.items) await v.done(i.id);
  const all = await v.chat('after getting the license what is the next step');
  assert.match(all.answer, /Every step after .* is already marked done/);
});

test('restaurant: the county health step stays Pending verification with no invented link', async () => {
  const v = await restaurantVisitor(app, 'visitor-rest-0003');
  const cl = await v.list();
  for (const i of cl.items) if (i.id !== 'health') await v.done(i.id);
  const r = await v.chat('what is my next step');
  assert.match(r.answer, /Next step: Check for a county health department permit\. \(Pending verification\)/);
  assert.match(r.answer, /Pending verification: /);
  assert.equal(r.links.length, 0);
  assert.doesNotMatch(r.answer, /confirmed|verified link exists/i);
});

test('restaurant: follow-ups "and then?" and "how do I do this step?" stay on track', async () => {
  const v = await restaurantVisitor(app, 'visitor-rest-0004');
  const a = await v.chat('what is my next step');
  const t1 = /Next step: (.+?)\. \(/.exec(a.answer)[1];
  const convo = [{ role: 'user', content: 'what is my next step' }, { role: 'assistant', content: a.answer }];
  const b = await v.chat('and then?', convo);
  const t2 = /Next step: (.+?)\. \(/.exec(b.answer)[1];
  assert.notEqual(t1, t2);
  assert.match(b.answer, new RegExp(`After "${t1.replace(/[()]/g, '.')}`));
  const how = await v.chat('how do I do this step?', [{ role: 'user', content: 'what is my next step' }, { role: 'assistant', content: a.answer }]);
  assert.match(how.answer, /Steps:|Check|Apply|File|Register|Set up|Report|Review/);
});

test('restaurant: only an explicit request returns the full checklist', async () => {
  const v = await restaurantVisitor(app, 'visitor-rest-0005');
  for (const q of ['show my full checklist', 'list all my steps', 'show me the whole checklist']) {
    const r = await v.chat(q);
    assert.match(r.answer, /Your checklist has \d+ steps/, q);
  }
  for (const q of ['what is my next step', 'after the license what next', "what's next"]) {
    const r = await v.chat(q);
    assert.doesNotMatch(r.answer, /Your checklist has \d+ steps/, q);
  }
});

test('next-step LLM rewrite is kept only if safe and still names the step and Pending verification', async () => {
  const v = await restaurantVisitor(app, 'visitor-rest-0006');
  const cl = await v.list();
  const items = cl.items.map((i) => ({ ...i, done: i.id !== 'health' }));
  const checklist = { saved: true, items };
  const g = await ask('what is my next step', { checklist });
  assert.match(g.answer, /Pending verification/);
  const good = await ask('what is my next step', { checklist, llm: async () => 'Your next move is Check for a county health department permit. It is Pending verification, so please confirm it with your county health department.' });
  assert.equal(good.mode, 'llm');
  const dropsStatus = await ask('what is my next step', { checklist, llm: async () => 'Your next move is Check for a county health department permit. You are all set there.' });
  assert.equal(dropsStatus.mode, 'grounded');
  const addsLink = await ask('what is my next step', { checklist, llm: async () => 'Check for a county health department permit, Pending verification. Go to https://kingcounty.gov/permit' });
  assert.equal(addsLink.mode, 'grounded');
});

test('"after the license" with no checklist uses the app order and does not claim it applies', async () => {
  const r = await ask('after getting the license what is the next step');
  assert.match(r.answer, /general order/);
  assert.doesNotMatch(r.answer, /not built|you have not/i);
  assert.match(r.answer, /Next in order: Confirm your list with the official Business Licensing Wizard/);
  assert.ok(r.links.length === 1 && /^https:/.test(r.links[0].url));
  assert.notEqual(r.mode, 'fallback');
});


// ---- Conversational context, missing scenario, and step-by-step guidance ----
const LICENSE = 'Apply for your Washington business license';
const WIZARD = 'Confirm your list with the official Business Licensing Wizard';
const turn = (q, r) => [{ role: 'user', content: q }, { role: 'assistant', content: r.answer }];

test('no scenario: "what is next step after getting license" is general, calm and not blaming', async () => {
  const r = await ask('what is next step after getting license');
  assert.match(r.answer, new RegExp(`Next in order: ${WIZARD}`));
  assert.match(r.answer, /Choose a sample business or complete the questionnaire/);
  assert.doesNotMatch(r.answer, /have not built|can't say whether/i);
  assert.doesNotMatch(r.answer, /Your checklist has/);
});

test('no scenario: "can you guide me how to fill" asks which form instead of dumping the checklist', async () => {
  const first = await ask('what is next step after getting license');
  const r = await ask('can you guide me how to fill', { conversation: turn('what is next step after getting license', first) });
  assert.match(r.answer, /Which one do you mean/);
  assert.ok(r.answer.includes(LICENSE) && r.answer.includes(WIZARD));
  assert.doesNotMatch(r.answer, /1\. File your business entity|Your checklist has/);
  assert.equal(r.suggestions.length, 2);
  assert.deepEqual(r.links, []);
});

test('picking the clarification option starts a one-step-at-a-time guide with only the stored link', async () => {
  const first = await ask('what is next step after getting license');
  const c1 = await ask('can you guide me how to fill', { conversation: turn('x', first) });
  const pick = c1.suggestions.find((x) => x.includes('Business Licensing Wizard'));
  const g1 = await ask(pick, { conversation: turn('can you guide me how to fill', c1) });
  assert.match(g1.answer, /Step 1 of 3 \(Confirm your list with the official Business Licensing Wizard\): Open the wizard\./);
  assert.match(g1.answer, /can't fill in or submit anything for you/);
  assert.match(g1.answer, /Say "next"/);
  assert.match(g1.answer, /Not yet Approved|Pending verification/);
  assert.equal(g1.links[0].url, 'https://secure.dor.wa.gov/gteunauth/?Link=wiz');
  assert.ok(!/Step 2/.test(g1.answer), 'one step at a time');
  const g2 = await ask('next', { conversation: turn('x', g1) });
  assert.match(g2.answer, /Step 2 of 3 \(/);
  assert.match(g2.answer, /Answer its questions about your business\./);
  assert.deepEqual(g2.links, []);
  const g3 = await ask('done', { conversation: turn('next', g2) });
  assert.match(g3.answer, /Step 3 of 3/);
  assert.match(g3.answer, /last step/);
  const end = await ask('next', { conversation: turn('done', g3) });
  assert.match(end.answer, /That was the last step/);
});

test('"guide me how to fill" after a single-task answer continues with that task', async () => {
  const dor = await ask('Do I need a business license?');
  const g = await ask('can you guide me how to fill', { conversation: turn('Do I need a business license?', dor) });
  assert.notEqual(g.mode, 'fallback');
  assert.equal(g.matched[0].id, 'dor');
  assert.match(g.answer, /Step 1 of 4/);
  assert.equal(g.links[0].url, 'https://secure.dor.wa.gov/home/Login');
});

test('a pending step is guided without a link and keeps Pending verification', async () => {
  const g = await ask('guide me through the county health permit');
  assert.equal(g.matched[0].id, 'health');
  assert.match(g.answer, /Pending verification/);
  assert.deepEqual(g.links, []);
});

test('plain "guide me" with nothing in context still gives the start overview', async () => {
  assert.match((await ask('guide me')).answer, /1\. File your business entity/);
});

test('restaurant checklist: both questions use the active checklist and its done state', async () => {
  const own = await startApp(); // own server: the chat route is rate limited to 20 calls a minute
  after(() => own.stop());
  const v = await restaurantVisitor(own, 'visitor-rest-0007');
  const a = await v.chat('what is next step after getting license');
  assert.match(a.answer, new RegExp(`Next step: ${WIZARD}`));
  assert.doesNotMatch(a.answer, /No business is selected|general order|have not built/);
  const b = await v.chat('can you guide me how to fill', turn('what is next step after getting license', a));
  assert.match(b.answer, /Which one do you mean/);
  assert.doesNotMatch(b.answer, /Your checklist has|1\. File your business entity/);
  const c = await v.chat('Guide me through the Business Licensing Wizard', turn('can you guide me how to fill', b));
  assert.match(c.answer, /Step 1 of 3/);
  const how = await v.chat('how do I do this step?', turn('Guide me through the Business Licensing Wizard', c));
  assert.equal(how.matched[0].id, 'wizard');
  const full = await v.chat('show my full checklist', turn('x', how));
  assert.match(full.answer, /Your checklist has 8 steps/);
  await v.done('dor');
  const d = await v.chat('what is next step after getting license');
  assert.match(d.answer, /\(marked done\)/);
});

// ---- Full QA question set (no scenario, restaurant, other scenarios, limits) ----
const SAMPLE = (id) => SAMPLES.find((x) => x.id === id);
async function visitorFor(own, id, sampleId) {
  const h = { 'x-visitor-id': id };
  await own.call('POST', '/api/checklist', { answers: SAMPLE(sampleId).answers, label: '' }, h);
  const chat = (message, conversation = []) => own.call('POST', '/api/chat', { message, conversation }, h).then((r) => r.body);
  const done = (ruleId) => own.call('PATCH', '/api/checklist/done', { ruleId, done: true }, h);
  return { chat, done };
}

test('basic questions: capabilities, start, license, wizard', async () => {
  const c = await ask('What can you help me with?');
  assert.match(c.answer, /can't fill in, submit or pay/);
  assert.doesNotMatch(c.answer, /1\. File your business entity/);
  const s = await ask('How do I start a business in Washington?');
  assert.match(s.answer, /1\. File your business entity/);
  assert.ok(s.answer.split('\n').length <= 8);
  assert.equal((await ask('What is a Washington business license?')).matched[0].id, 'dor');
  assert.equal((await ask('What is the Business Licensing Wizard?')).matched[0].id, 'wizard');
});

test('no-scenario follow-up chain: next, guide, which one, next, after that, explain again, full checklist', async () => {
  let convo = [];
  const say = async (q) => { const r = await ask(q, { conversation: convo }); convo = [...convo, { role: 'user', content: q }, { role: 'assistant', content: r.answer }]; return r; };
  assert.match((await say('What is the next step after getting my business license?')).answer, /Next in order: Confirm your list with the official Business Licensing Wizard/);
  assert.match((await say('Can you guide me on how to fill it out?')).answer, /Which one do you mean/);
  const which = await say('Which one should I select?');
  assert.match(which.answer, /Here is the difference/);
  assert.match(which.answer, /Run the Business Licensing Wizard/);
  assert.match((await say('Next.')).answer, /Which one first\?/);
  assert.match((await say('What should I do after that?')).answer, /Which one first\?/);
  assert.match((await say('Can you explain that step again?')).answer, /Here is the difference/);
  const full = await say('Show me my full checklist.');
  assert.match(full.answer, /No business is selected yet/);
  assert.doesNotMatch(full.answer, /1\. File/);
});

test('no-scenario: after a guided step, "explain again" repeats that step and "after that" moves on', async () => {
  const g1 = await ask('Guide me through the Business Licensing Wizard');
  let convo = [{ role: 'user', content: 'x' }, { role: 'assistant', content: g1.answer }];
  const again = await ask('Can you explain that step again?', { conversation: convo });
  assert.match(again.answer, /Here is that step again\./);
  assert.match(again.answer, /Step 1 of 3/);
  const after = await ask('What should I do after that?', { conversation: convo });
  assert.match(after.answer, /Next in order: Register as a contractor/);
});

test('restaurant QA set: first step, county permit, employees, pending, completed first two', async () => {
  const own = await startApp(); after(() => own.stop());
  const v = await visitorFor(own, 'visitor-qa-rest-01', 'restaurant');
  assert.match((await v.chat('What should I do first?')).answer, /Next step: File your business entity/);
  const county = await v.chat('Do I need a county health permit?');
  assert.match(county.answer, /is on your checklist, but it is Pending verification, so I can't confirm it is required/);
  assert.deepEqual(county.links, []);
  const emp = await v.chat('What do I need to do for my employees?');
  assert.match(emp.answer, /workers' compensation/i);
  assert.match(emp.answer, /employer taxes with Employment Security \(Pending verification\)/);
  assert.match(emp.answer, /Report new hires to DSHS/);
  const pend = await v.chat('What is still pending?');
  assert.match(pend.answer, /3 of your 8 steps are Pending verification/);
  const two = await v.chat('What should I do if I have completed the first two steps?');
  assert.match(two.answer, /^If you have completed the first 2 steps/);
  assert.match(two.answer, /Next step: Confirm your list with the official Business Licensing Wizard/);
});

test('incorrect-information probes never confirm, invent a fee, approve, or invent a link', async () => {
  const own = await startApp(); after(() => own.stop());
  const v = await visitorFor(own, 'visitor-qa-rest-02', 'restaurant');
  const a = await v.chat('Is a county health permit definitely required in Bellevue?');
  assert.match(a.answer, /can't confirm that it is definitely required/);
  assert.match(a.answer, /Pending verification/);
  assert.doesNotMatch(a.answer, /^Yes/);
  const fee = await v.chat('What is the exact health permit fee?');
  assert.match(fee.answer, /don't have a verified fee/);
  assert.doesNotMatch(fee.answer, /\$\d/);
  const appr = await v.chat('Are all my local requirements approved?');
  assert.match(appr.answer, /^No\. Nothing in this demo is Approved/);
  const link = await v.chat('Give me the official link for the pending county requirement.');
  assert.match(link.answer, /don't have a verified official link/);
  for (const l of link.links) assert.ok(allUrls.has(l.url));
  assert.doesNotMatch(JSON.stringify(link.links), /dor\.wa\.gov\/open-business"/);
});

test('progress questions use the real done state', async () => {
  const own = await startApp(); after(() => own.stop());
  const v = await visitorFor(own, 'visitor-qa-rest-03', 'restaurant');
  assert.match((await v.chat('What have I already completed?')).answer, /not marked any step as done/);
  await v.done('sos'); await v.done('dor');
  assert.match((await v.chat('What is my next step?')).answer, /Next step: Confirm your list with the official Business Licensing Wizard/);
  const inc = await v.chat('What tasks are incomplete?');
  assert.match(inc.answer, /6 of 8 steps are still open/);
  assert.doesNotMatch(inc.answer, /- File your business entity|- Apply for your Washington/);
  const dn = await v.chat('What have I already completed?');
  assert.match(dn.answer, /2 of 8 steps done/);
  assert.match((await v.chat('Show me my full checklist.')).answer, /Your checklist has 8 steps\. 2 marked done/);
});

test('other scenarios: sole proprietor and construction answers follow their checklists', async () => {
  const own = await startApp(); after(() => own.stop());
  const home = await visitorFor(own, 'visitor-qa-home-01', 'home');
  const sos = await home.chat('Do I need to register with the Secretary of State?');
  assert.match(sos.answer, /^No\. "File your business entity with the Secretary of State" is not on your checklist/);
  assert.match(sos.answer, /Left out because sole proprietors/);
  assert.match((await home.chat('What changes if I hire an employee?')).answer, /no employee steps/);
  const con = await visitorFor(own, 'visitor-qa-con-01', 'contractor');
  assert.match((await con.chat('Do I need contractor registration?')).answer, /^Yes, "Register as a contractor with Labor & Industries" is on your checklist \(Applies to you\)/);
  const next = await con.chat('What are my next steps?');
  assert.match(next.answer, /Next step: /);
  assert.doesNotMatch(next.answer, /Your checklist has/);
  const rest = await con.chat('Do I need a restaurant health permit?');
  assert.match(rest.answer, /^No\. "Check for a county health department permit" is not on your checklist/);
});

test('limits: no submitting, off-topic fallback, no guarantees', async () => {
  const sub = await ask('Can you submit my business license application for me?');
  assert.match(sub.answer, /^No\. I can't submit, fill in, pay for or file anything for you/);
  assert.equal(sub.links[0].url, 'https://secure.dor.wa.gov/home/Login');
  assert.equal((await ask('What is the capital of France?')).mode, 'fallback');
  const g = await ask('Can you guarantee that my business meets every legal requirement?');
  assert.match(g.answer, /^No, I can't guarantee that/);
  assert.match(g.answer, /not legal advice/);
});


// ---- Follow-up sequencing: "What comes after that?" must advance, never loop ----
const stepTitle = (answer) => /(?:Next step|Next in order): (.+?)\. \(/.exec(answer)?.[1];
async function sequenceEnv(id, sampleId) {
  const own = await startApp();
  after(() => own.stop());
  const h = { 'x-visitor-id': id };
  if (sampleId) await own.call('POST', '/api/checklist', { answers: SAMPLES.find((x) => x.id === sampleId).answers, label: '' }, h);
  let convo = [];
  const say = async (message) => {
    const r = await own.call('POST', '/api/chat', { message, conversation: convo }, h).then((x) => x.body);
    convo = [...convo, { role: 'user', content: message }, { role: 'assistant', content: r.answer }].slice(-8);
    return r;
  };
  const done = (ruleId) => own.call('PATCH', '/api/checklist/done', { ruleId, done: true }, h);
  const items = () => own.call('GET', '/api/checklist', null, h).then((x) => x.body.items);
  return { say, done, items };
}

for (const [sampleId, label] of [['home', 'home-based'], ['restaurant', 'restaurant'], ['contractor', 'construction']]) {
  test(`${label}: "What is my first step?" then the suggested "What comes after that?" button walks the checklist in order and ends clearly`, async () => {
    const env = await sequenceEnv(`visitor-seq-${sampleId}-01`, sampleId);
    const order = (await env.items()).map((i) => i.title);
    let r = await env.say('What is my first step?');
    assert.equal(stepTitle(r.answer), order[0]);
    const seen = [order[0]];
    for (let i = 1; i < order.length; i += 1) {
      assert.ok(r.suggestions.includes('What comes after that?'), 'the button is offered');
      r = await env.say('What comes after that?'); // exactly the button text
      assert.equal(stepTitle(r.answer), order[i], `step ${i + 1}`);
      assert.ok(!seen.includes(stepTitle(r.answer)), 'no looping back');
      assert.match(r.answer, new RegExp(`^After "${order[i - 1].replace(/[()?.]/g, '.')}`));
      seen.push(order[i]);
    }
    const end = await env.say('What comes after that?');
    assert.match(end.answer, /is the last step on your checklist, so nothing comes after it/);
    assert.equal(stepTitle(end.answer), undefined);
    assert.deepEqual(end.links, []);
  });
}

test('restaurant: typed "What comes after that?", "Next", "And then?" and "What is the next step?" all advance from the same step', async () => {
  for (const q of ['What comes after that?', 'Next', 'And then?', 'What is the next step?', 'Next.', 'then what?']) {
    const env = await sequenceEnv(`visitor-seq-typed-${q.length}-${Math.random().toString(36).slice(2, 8)}`, 'restaurant');
    const order = (await env.items()).map((i) => i.title);
    await env.say('What is my first step?');
    const r = await env.say(q);
    assert.equal(stepTitle(r.answer), order[1], q);
    assert.notEqual(stepTitle(r.answer), order[0], q);
  }
});

test('restaurant: "What is my next step?" still means the first open step, not the one after the last answer', async () => {
  const env = await sequenceEnv('visitor-seq-my-01', 'restaurant');
  const order = (await env.items()).map((i) => i.title);
  await env.say('What is my first step?');
  const r = await env.say('What is my next step?');
  assert.equal(stepTitle(r.answer), order[0]);
});

test('restaurant: steps marked done are skipped when advancing', async () => {
  const env = await sequenceEnv('visitor-seq-done-01', 'restaurant');
  const items = await env.items();
  await env.done(items[1].id); // license
  await env.done(items[2].id); // wizard
  let r = await env.say('What is my first step?');
  assert.equal(stepTitle(r.answer), items[0].title);
  r = await env.say('What comes after that?');
  assert.equal(stepTitle(r.answer), items[3].title); // county health permit
  assert.match(r.answer, /Pending verification/);
  assert.deepEqual(r.links, []);
  r = await env.say('And then?');
  assert.equal(stepTitle(r.answer), items[4].title);
});

test('restaurant: nothing after the last open step says so, and earlier open steps are mentioned', async () => {
  const env = await sequenceEnv('visitor-seq-last-01', 'restaurant');
  const items = await env.items();
  for (const i of items.slice(0, -1)) if (i.id !== items[0].id) await env.done(i.id);
  let r = await env.say('What is my first step?');
  assert.equal(stepTitle(r.answer), items[0].title);
  r = await env.say('What comes after that?');
  assert.equal(stepTitle(r.answer), items.at(-1).title);
  r = await env.say('What comes after that?');
  assert.match(r.answer, /is the last step on your checklist, so nothing comes after it/);
  assert.match(r.answer, new RegExp(`Still open earlier on your list: ${items[0].title}`));
});

test('after a non-step answer, "and then?" continues from the step just discussed', async () => {
  const env = await sequenceEnv('visitor-seq-topic-01', 'restaurant');
  const order = (await env.items()).map((i) => i.title);
  await env.say('How long does the DOR business license take to process?');
  const r = await env.say('and then?');
  assert.equal(stepTitle(r.answer), order[2]);
});

test('no scenario: sequencing is general, explains personalization, never repeats or loops, and ends clearly', async () => {
  const env = await sequenceEnv('visitor-seq-none-01', null);
  const order = orderedTitles();
  let r = await env.say('What is my first step?');
  assert.equal(stepTitle(r.answer), order[0]);
  assert.match(r.answer, /Choose a sample business or complete the questionnaire/);
  const seen = [order[0]];
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(r.suggestions.includes('What comes after that?'), 'button offered in no-scenario mode');
    r = await env.say('What comes after that?');
    assert.equal(stepTitle(r.answer), order[i], `step ${i + 1}`);
    assert.ok(!seen.includes(order[i]));
    assert.match(r.answer, /Choose a sample business or complete the questionnaire/);
    seen.push(order[i]);
  }
  r = await env.say('What comes after that?');
  assert.match(r.answer, /last step in this app's general order, so nothing comes after it/);
  assert.equal(stepTitle(r.answer), undefined);
});

function orderedTitles() {
  return [...rules].sort((a, b) => a.order - b.order).map((r) => r.title);
}

test('follow-up answers keep official links from the records and the status line', async () => {
  const env = await sequenceEnv('visitor-seq-links-01', 'restaurant');
  await env.say('What is my first step?');
  const r = await env.say('What comes after that?');
  for (const l of r.links) assert.ok(allUrls.has(l.url), l.url);
  assert.ok(r.links.length >= 1);
  assert.match(r.answer, /Applies to you|Pending verification|May apply/);
});
