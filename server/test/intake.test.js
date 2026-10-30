import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startApp } from './helpers.js';
import { intakeTurn, planFromCard, buildTimeline, blankCard, confirmedAnswers, extractFacts, isComplete, CARD_FIELDS } from '../src/intake.js';

const seed = (n) => JSON.parse(readFileSync(new URL(`../seed/${n}`, import.meta.url), 'utf8'));
const places = seed('wa_places.json').places;
const rulesDoc = seed('rules.json');
const times = seed('processing_times.json');
const turn = (input) => intakeTurn(input, { places });

// Walk a card to complete with direct answers, like tapping chips.
function finishCard(start) {
  let t = start;
  let guard = 0;
  while (!t.complete && guard++ < 20) {
    const field = t.ask?.field;
    assert.ok(field, 'guide should keep asking until the card is complete');
    const answer = { structure: 'sole', activity: 'other', place: 'skip', hiring: 'no', subs: 'no', salestax: 'no', income: 'no', tradename: 'no' }[field];
    t = turn({ card: t.card, action: 'set', field, value: answer });
  }
  return t;
}

test('the food truck story fills the card as HEARD, not confirmed, and the plan stays empty', () => {
  const t = turn({ card: blankCard(), message: 'I want to open a food truck in Spokane and hire two people.' });
  assert.deepEqual(t.card.values.cats, ['food']);
  assert.equal(t.card.values.city, 'Spokane');
  assert.equal(t.card.values.county, 'Spokane');
  assert.equal(t.card.values.hiring, 'yes');
  assert.equal(t.card.employees, 2);
  for (const f of ['activity', 'place', 'hiring']) assert.equal(t.card.status[f], 'heard');
  assert.match(t.reply, /^I heard: .*Spokane.*2 people.*Is that right\?$/);
  assert.deepEqual(t.chips.map((c) => c.value), ['confirm', 'change']);
  // Nothing reaches the rules engine before the owner confirms.
  assert.equal(planFromCard(t.card, rulesDoc.rules).items.length, 0);
  assert.deepEqual(confirmedAnswers(t.card), { structure: '', desc: '', cats: [], city: '', county: '', hiring: '', subs: '', salestax: '', income: '', tradename: '' });
});

test('confirming moves heard facts to confirmed, then the guide asks only for what is missing', () => {
  let t = turn({ card: blankCard(), message: 'I want to open a food truck in Spokane and hire two people.' });
  t = turn({ card: t.card, action: 'confirm' });
  assert.equal(t.ask.field, 'structure', 'structure was not mentioned, so the guide asks');
  const ids = planFromCard(t.card, rulesDoc.rules).items.map((i) => i.id);
  assert.ok(ids.includes('health') && ids.includes('lni-wc') && ids.includes('dshs'));
  assert.ok(!ids.includes('lni-contractor'));
  for (const f of ['activity', 'place', 'hiring']) assert.equal(t.card.status[f], 'confirmed');
  assert.equal(t.card.status.subs, undefined);
});

test('every plan step carries the answer that triggered it', () => {
  let t = turn({ card: blankCard(), message: 'I want to open a food truck in Spokane and hire two people.' });
  t = turn({ card: t.card, action: 'confirm' });
  const plan = planFromCard(t.card, rulesDoc.rules);
  const health = plan.items.find((i) => i.id === 'health');
  assert.match(health.trigger, /You chose food service/);
  assert.match(plan.items.find((i) => i.id === 'lni-wc').trigger, /You plan to hire/);
  for (const i of plan.items) assert.ok(i.trigger, `${i.id} needs a trigger`);
});

test('a one-word answer to the question just asked is confirmed on the spot', () => {
  let t = turn({ card: blankCard(), message: 'I will open an LLC restaurant.' });
  t = turn({ card: t.card, action: 'confirm' });
  assert.equal(t.card.values.structure, 'llc');
  assert.equal(t.ask.field, 'place');
  t = turn({ card: t.card, message: 'skip', asking: 'place' });
  assert.equal(t.ask.field, 'hiring');
  const t2 = turn({ card: t.card, message: 'yes', asking: 'hiring' });
  assert.equal(t2.card.status.hiring, 'confirmed');
  assert.equal(t2.card.values.hiring, 'yes');
  assert.equal(t2.ask.field, 'subs');
});

test('"not sure" is kept as not sure, never turned into yes', () => {
  const t = turn({ card: blankCard(), message: 'not sure', asking: 'structure' });
  assert.equal(t.card.values.structure, 'unsure');
  assert.equal(t.card.status.structure, 'confirmed');
});

test('subcontractors alone never make a contractor; only a confirmed construction type does', () => {
  let t = turn({ card: blankCard(), message: 'I will run a restaurant and use subcontractors.' });
  t = turn({ card: t.card, action: 'confirm' });
  let ids = planFromCard(t.card, rulesDoc.rules).items.map((i) => i.id);
  assert.ok(ids.includes('ic'));
  assert.ok(!ids.includes('lni-contractor'));
  let c = turn({ card: blankCard(), message: 'I do remodeling and framing and I will hire two people.' });
  c = turn({ card: c.card, action: 'confirm' });
  ids = planFromCard(c.card, rulesDoc.rules).items.map((i) => i.id);
  assert.ok(ids.includes('lni-contractor'));
});

test('a changed fact is heard again and must be re-confirmed', () => {
  let t = turn({ card: blankCard(), message: 'I want a restaurant in Bellevue.' });
  t = turn({ card: t.card, action: 'confirm' });
  const again = turn({ card: t.card, message: 'Actually it is in Spokane' });
  assert.equal(again.card.values.city, 'Spokane');
  assert.equal(again.card.status.place, 'heard');
});

test('tapping a row to edit confirms that field', () => {
  const t = turn({ card: blankCard(), action: 'set', field: 'hiring', value: 'yes' });
  assert.equal(t.card.status.hiring, 'confirmed');
  const bad = turn({ card: t.card, action: 'set', field: 'hiring', value: 'banana' });
  assert.equal(bad.card.status.hiring, undefined, 'an invalid value clears the row instead of storing it');
});

test('"Change something" never confirms anything', () => {
  let t = turn({ card: blankCard(), message: 'a cafe in Bellevue' });
  t = turn({ card: t.card, action: 'change' });
  assert.equal(t.card.status.activity, 'heard');
  assert.match(t.reply, /Tap any row/);
});

test('a city word is not mistaken for a place without "in" or "near" before it', () => {
  const f = extractFacts('I want to open Home services and Index my records', places);
  assert.equal(f.city, undefined);
  assert.equal(extractFacts('a coffee shop in Bellevue, WA', places).city, 'Bellevue');
  assert.equal(extractFacts('a bakery in Spokane County', places).county, 'Spokane');
});

test('income and sales tax are read carefully', () => {
  assert.equal(extractFacts('I expect to make $40,000 a year', places).income, 'yes');
  assert.equal(extractFacts('I will earn about $5,000 a year', places).income, 'no');
  assert.equal(extractFacts('we will collect sales tax', places).salestax, 'yes');
  assert.equal(extractFacts('services only, no sales tax', places).salestax, 'no');
  assert.equal(extractFacts('no employees, just me', places).hiring, 'no');
});

test('the card is complete only when every row is confirmed, and then the plan includes "may apply" steps', () => {
  let t = turn({ card: blankCard(), message: 'I will open a cafe in Bellevue.' });
  t = turn({ card: t.card, action: 'confirm' });
  t = finishCard(t);
  assert.ok(isComplete(t.card));
  assert.equal(CARD_FIELDS.filter((f) => t.card.status[f] === 'confirmed').length, CARD_FIELDS.length);
  assert.deepEqual(t.chips.map((c) => c.value), ['save']);
  const plan = planFromCard(t.card, rulesDoc.rules);
  assert.ok(plan.complete && plan.skipped.length > 0, 'left-out steps are listed once the card is complete');
});

test('the timeline shows only times recorded in doc 11 and says so for every other step', () => {
  let t = turn({ card: blankCard(), message: 'I will do remodeling and hire two people in Spokane.' });
  t = turn({ card: t.card, action: 'confirm' });
  t = finishCard(t);
  const plan = planFromCard(t.card, rulesDoc.rules);
  const tl = buildTimeline(plan, rulesDoc.phases, times, new Date('2026-10-28T12:00:00Z'));
  const timed = tl.phases.flatMap((p) => p.steps).filter((s) => s.time);
  assert.deepEqual(timed.map((s) => s.id).sort(), ['dor', 'lni-contractor']);
  assert.equal(timed.find((s) => s.id === 'dor').time.text, 'approximately 10 business days');
  assert.equal(timed.find((s) => s.id === 'lni-contractor').time.text, '3 to 4 weeks after the application is received');
  assert.ok(tl.estimate.noPublishedTime.length >= 4);
  assert.match(tl.estimate.note, /not a guarantee/);
  // 10 business days after Wed Oct 28 2026 is Wed Nov 11; the L&I 21 calendar days end Nov 18, which is the later date.
  assert.equal(tl.estimate.date, '2026-11-18');
});

test('no opening date until the card is complete', () => {
  let t = turn({ card: blankCard(), message: 'I will do remodeling and hire two people.' });
  t = turn({ card: t.card, action: 'confirm' });
  const plan = planFromCard(t.card, rulesDoc.rules);
  const tl = buildTimeline(plan, rulesDoc.phases, times);
  assert.equal(tl.estimate, null);
  assert.equal(tl.pending, true);
});

test('no estimate when none of the steps has a recorded time', () => {
  let t = turn({ card: blankCard(), message: 'a cafe, no employees, just me' });
  t = turn({ card: t.card, action: 'confirm' });
  t = turn({ card: t.card, action: 'set', field: 'structure', value: 'sole' });
  t = turn({ card: t.card, action: 'set', field: 'place', value: 'skip' });
  for (const f of ['subs', 'salestax', 'income', 'tradename']) t = turn({ card: t.card, action: 'set', field: f, value: 'no' });
  const tl = buildTimeline(planFromCard(t.card, rulesDoc.rules), rulesDoc.phases, times);
  assert.equal(tl.estimate, null);
});

test('API: turn, plan and a question routed to the grounded helper', async () => {
  const app = await startApp({ adminKey: 'k' });
  try {
    const a = await app.call('POST', '/api/intake/turn', { message: 'I want to open a food truck in Spokane and hire two people.', card: blankCard() });
    assert.equal(a.status, 200);
    assert.equal(a.body.card.status.place, 'heard');
    const b = await app.call('POST', '/api/intake/turn', { action: 'confirm', card: a.body.card });
    const plan = await app.call('POST', '/api/intake/plan', { card: b.body.card });
    assert.ok(plan.body.plan.items.length >= 5);
    assert.equal(plan.body.timeline.estimate, null);
    const q = await app.call('POST', '/api/intake/turn', { message: 'Do I need a business license?', card: b.body.card });
    assert.equal(q.status, 200);
    assert.ok(q.body.reply.length > 20);
    assert.ok(q.body.followUp, 'the guide goes back to the question it was on');
    assert.equal(q.body.card.status.hiring, 'confirmed', 'a question never changes the card');
  } finally {
    await app.stop();
  }
});

test('API: a spoken question with no question mark and filler words still gets an answer, not "I did not catch that"', async () => {
  const app = await startApp();
  try {
    const first = await app.call('POST', '/api/intake/turn', { message: 'I want to open a bakery', card: blankCard() });
    for (const message of ['see I want to start a new business so tell me what are the steps clearly', 'so what do I need to do first', 'tell me about the license']) {
      const q = await app.call('POST', '/api/intake/turn', { message, card: first.body.card, asking: 'structure' });
      assert.equal(q.status, 200);
      assert.doesNotMatch(q.body.reply, /did not catch/, message);
      assert.ok(q.body.followUp, message);
    }
    const ans = await app.call('POST', '/api/intake/turn', { message: 'LLC', card: first.body.card, asking: 'structure' });
    assert.equal(ans.body.card.values.structure, 'llc', 'a plain answer is still taken as an answer');
  } finally {
    await app.stop();
  }
});

test('API: an overlong or malformed card is cleaned, not trusted', async () => {
  const app = await startApp();
  try {
    const r = await app.call('POST', '/api/intake/plan', { card: { values: { hiring: '<script>', cats: ['x'], structure: 'llc' }, status: { structure: 'confirmed', hiring: 'confirmed', bogus: 'confirmed' } } });
    assert.equal(r.status, 200);
    assert.equal(r.body.answers.hiring, '');
    assert.deepEqual(r.body.answers.cats, []);
    const t = await app.call('POST', '/api/intake/turn', { message: 'x'.repeat(600), card: blankCard() });
    assert.equal(t.status, 400);
  } finally {
    await app.stop();
  }
});

test('API: simulate a rule change works without the admin key, changes no rule, and writes one labeled alert', async () => {
  const app = await startApp({ adminKey: 'secret-for-test' });
  try {
    let t = turn({ card: blankCard(), message: 'I will open a cafe in Bellevue and hire two people.' });
    t = turn({ card: t.card, action: 'confirm' });
    t = finishCard(t);
    const visitor = { 'x-visitor-id': 'sim-visitor-0001' };
    const rulesBefore = JSON.stringify((await app.call('GET', '/api/rules')).body.rules);
    const r = await app.call('POST', '/api/simulate/rule-change', { card: t.card }, visitor);
    assert.equal(r.status, 200);
    assert.equal(r.body.simulated, true);
    assert.equal(r.body.affected, true);
    assert.equal(r.body.before.text, 'approximately 10 business days');
    assert.equal(r.body.after.text, 'approximately 15 business days');
    assert.equal(r.body.notice.draft, true);
    assert.notEqual(r.body.timelineBefore.estimate.date, r.body.timelineAfter.estimate.date);
    assert.equal(r.body.alert.simulated, true);
    const notes = await app.call('GET', '/api/notifications', undefined, visitor);
    assert.ok(notes.body.notifications.some((n) => /^Simulation:/.test(n.title) && n.simulated === true));
    assert.equal(JSON.stringify((await app.call('GET', '/api/rules')).body.rules), rulesBefore, 'no stored rule changed');
    // A plan without the DOR step is told nothing moved for it.
    const none = await app.call('POST', '/api/simulate/rule-change', { card: blankCard() });
    assert.equal(none.body.affected, false);
    assert.equal(none.body.alert, null);
  } finally {
    await app.stop();
  }
});

test('refresh fix: with CLIENT_DIST set, any page path returns the app, API paths still return JSON', async () => {
  const dist = mkdtempSync(path.join(os.tmpdir(), 'wa-dist-'));
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>app</title><div id="root"></div>');
  writeFileSync(path.join(dist, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const app = await startApp({ clientDist: dist });
  try {
    for (const p of ['/', '/guide', '/checklist', '/sources', '/some/deep/link']) {
      const res = await fetch(`${app.base}${p}`);
      assert.equal(res.status, 200, p);
      assert.match(await res.text(), /id="root"/, p);
    }
    assert.equal((await fetch(`${app.base}/favicon.svg`)).status, 200);
    const api = await fetch(`${app.base}/api/nope`);
    assert.equal(api.status, 404);
    assert.match(api.headers.get('content-type'), /json/);
    assert.equal((await fetch(`${app.base}/api/health`)).status, 200);
  } finally {
    await app.stop();
  }
});

test('refresh fix: without CLIENT_DIST the server stays API-only', async () => {
  const app = await startApp();
  try {
    assert.equal((await fetch(`${app.base}/guide`)).status, 404);
  } finally {
    await app.stop();
  }
});

test('API: real questions get grounded answers, and out-of-scope ones are said to be out of scope', async () => {
  const app = await startApp();
  try {
    const ask = async (message) => (await app.call('POST', '/api/intake/turn', { message, card: blankCard(), asking: 'structure' })).body;
    const cases = [
      ['What is a trade name?', /business license/i, /contractor/i],
      ['What if I earn less than 12000 dollars?', /business license/i, /don't have that/i],
      ['Do I need a health permit for a restaurant?', /health department/i, /I heard/],
      ['Do I need to register as a contractor?', /contractor/i, /I heard/],
      ['Do I have to collect sales tax?', /business license/i, /I heard/],
      ['How do I register a trademark?', /outside what this demo covers/i, /Register as a contractor/i],
      ['Where do I file my annual report?', /outside what this demo covers/i, /File your business entity/i],
      ['tell me the steps clearly', /Secretary of State/i, /did not catch/i],
    ];
    for (const [q, yes, no] of cases) {
      const r = await ask(q);
      assert.match(r.reply, yes, q);
      assert.doesNotMatch(r.reply, no, q);
      assert.ok(r.followUp, q);
    }
    const s = await ask('I want to open a food truck in Spokane and hire two people');
    assert.match(s.reply, /^I heard/, 'a statement about the business still goes to the card');
  } finally {
    await app.stop();
  }
});

test('API: how real people talk, typed or spoken, gets a sensible reply', async () => {
  const app = await startApp();
  try {
    const ask = async (message, extra = {}) => (await app.call('POST', '/api/intake/turn', { message, card: blankCard(), asking: 'structure', ...extra })).body;
    const cases = [
      ['hi', /answer questions/i, /did not catch/i],
      ['thanks', /welcome/i, /did not catch/i],
      ['i wanna start a business', /Secretary of State/i, /did not catch/i],
      ['i need a business licence', /business license/i, /did not catch/i],
      ['im confused', /No problem/i, /did not catch/i],
      ['whats the first thing i should do', /Secretary of State/i, /No business is selected/i],
      ['what should i do next', /Secretary of State/i, /No business is selected/i],
      ['i dont have any employees do i still need workers comp', /workers' compensation/i, /No business is selected/i],
      ['how much will all this cost me', /can't give a total/i, /don't have that/i],
      ['how long until i can open', /10 business days/i, /don't have that/i],
      ['can u fill the forms for me', /can't submit/i, /don't have that/i],
      ['are you a real person', /AI guide/i, /Register as a contractor/i],
      ['is this official', /not an official/i, /Wizard/i],
      ['does this work in oregon', /Washington State only/i, /don't have that/i],
      ['what is a seasonal business', /don't have that/i, /File your business entity/i],
      ['what is a UBI number', /Unified Business Identifier/i, /don't have that/i],
      ['i am a plumber what do i need', /contractor/i, /I heard/],
    ];
    for (const [q, yes, no] of cases) {
      const r = await ask(q);
      assert.match(r.reply, yes, q);
      assert.doesNotMatch(r.reply, no, q);
    }
    for (const q of ['yes', 'ok']) assert.match((await ask(q)).reply, /did not catch/i, `${q}: a bare word is not a question`);
    const a = await ask('LLC');
    assert.equal(a.card.values.structure, 'llc');
    const b = await ask('i want to open a bakery in Tacoma and i dont have any employees', { asking: null });
    assert.equal(b.card.values.hiring, 'no');
    const c = await ask('i want to sell alcohol at my restaurant', { asking: null });
    assert.match(c.reply, /special licenses/i);
  } finally {
    await app.stop();
  }
});

test('API: saying "yes that is right" or "no that is wrong" aloud works like the buttons', async () => {
  const app = await startApp();
  try {
    const call = async (body) => (await app.call('POST', '/api/intake/turn', body)).body;
    const first = await call({ message: 'I wanted to start his LLC', card: blankCard() });
    assert.equal(first.card.status.structure, 'heard');
    for (const m of ['yes that is right', 'yeah', "that's right", "is that's right", 'correct', 'yes please', "yep that's correct", 'sounds good', 'okay']) {
      const r = await call({ message: m, card: first.card });
      assert.equal(r.card.status.structure, 'confirmed', m);
      assert.doesNotMatch(r.reply, /don't have that|did not pick/i, m);
    }
    for (const m of ['no', "no that's wrong", 'not right', 'wrong']) {
      const r = await call({ message: m, card: first.card });
      assert.equal(r.card.status.structure, 'heard', `${m} must not confirm`);
      assert.match(r.reply, /change/i, m);
    }
    const q = await call({ message: 'what is an LLC?', card: first.card });
    assert.equal(q.card.status.structure, 'heard', 'a question is not a yes');
    const yn = await call({ message: 'yes', card: { ...first.card, status: { ...first.card.status, structure: 'confirmed' } }, asking: 'hiring' });
    assert.equal(yn.card.status.hiring, 'confirmed', 'a yes to a yes/no question is still an answer');
  } finally {
    await app.stop();
  }
});

test('API: a city that was not understood is not answered with "I don\'t have that", and the business description is tidy', async () => {
  const app = await startApp();
  try {
    const call = async (body) => (await app.call('POST', '/api/intake/turn', body)).body;
    const r = await call({ message: 'the city was believe you', card: blankCard(), asking: 'place' });
    assert.match(r.reply, /did not catch a Washington city/i);
    assert.equal(r.card.status.place, undefined);
    const a = await call({ message: 'wanted to start a food service', card: blankCard(), asking: 'activity' });
    assert.equal(a.card.values.desc, 'food service');
    const b = await call({ message: 'I want to open a food truck in Spokane', card: blankCard() });
    assert.match(b.card.values.desc, /food truck/);
    const c = await call({ message: 'seattle', card: blankCard(), asking: 'place' });
    assert.equal(c.card.values.city, 'Seattle');
  } finally {
    await app.stop();
  }
});

test('spoken yes/no answers with extra words are still the answer', () => {
  const ans = (message, field = 'subs') => turn({ card: blankCard(), message, asking: field }).card.values[field];
  for (const m of ['hello yes yes', 'yes yes', 'yeah we will', 'yes please', 'sure', 'uh yes']) assert.equal(ans(m), 'yes', m);
  for (const m of ['no no', 'no thanks', 'nope', "no I don't", 'hello no']) assert.equal(ans(m), 'no', m);
  assert.equal(ans('not sure'), 'unsure');
  assert.equal(ans('hello yes yes', 'hiring'), 'yes');
});

test('a rambling answer about the kind of business is tidied or dropped', () => {
  const desc = (m) => turn({ card: blankCard(), message: m, asking: 'activity' }).card.values.desc;
  assert.equal(desc('so it is in construction'), 'construction');
  assert.equal(desc('wanted to start a food service'), 'food service');
  assert.equal(desc('we are basically a company that does a whole lot of different kinds of construction work for people'), '');
});

// ---- Spanish (draft text, pending review by a person) ----
test('Spanish: the guide understands a Spanish story and reads it back in Spanish', async () => {
  const app = await startApp();
  try {
    const call = async (body) => (await app.call('POST', '/api/intake/turn', { lang: 'es', ...body })).body;
    const a = await call({ message: 'Quiero abrir un camión de comida en Spokane y contratar a dos personas', card: blankCard() });
    assert.match(a.reply, /^Entendí:/);
    assert.match(a.reply, /Servicio de comida/);
    assert.match(a.reply, /Spokane, Condado de Spokane/);
    assert.match(a.reply, /contratará a 2 personas dentro de 90 días/);
    assert.match(a.reply, /¿Es correcto\?/);
    assert.deepEqual(a.chips.map((c) => c.label), ['Sí, es correcto', 'Cambiar algo']);
    assert.equal(a.card.values.hiring, 'yes');
    assert.equal(a.card.employees, 2);
    for (const m of ['sí', 'sí es correcto', 'claro', 'correcto', 'exacto']) {
      const r = await call({ message: m, card: a.card });
      assert.equal(r.card.status.hiring, 'confirmed', m);
      assert.match(r.reply, /¿Cómo estará organizado su negocio\?/, m);
    }
    for (const m of ['no', 'no es correcto', 'incorrecto']) {
      const r = await call({ message: m, card: a.card });
      assert.equal(r.card.status.hiring, 'heard', m);
      assert.match(r.reply, /Toque cualquier fila/);
    }
  } finally {
    await app.stop();
  }
});

test('Spanish: yes/no answers, structure and every question come out in Spanish', async () => {
  const app = await startApp();
  try {
    const call = async (body) => (await app.call('POST', '/api/intake/turn', { lang: 'es', ...body })).body;
    for (const m of ['sí', 'sí sí', 'claro que sí', 'hola sí']) assert.equal((await call({ message: m, card: blankCard(), asking: 'subs' })).card.values.subs, 'yes', m);
    for (const m of ['no', 'no gracias', 'nunca']) assert.equal((await call({ message: m, card: blankCard(), asking: 'subs' })).card.values.subs, 'no', m);
    assert.equal((await call({ message: 'no estoy seguro', card: blankCard(), asking: 'income' })).card.values.income, 'unsure');
    const s = await call({ message: 'propietario único', card: blankCard(), asking: 'structure' });
    assert.equal(s.card.values.structure, 'sole');
    assert.match(s.reply, /¿Qué tipo de negocio es\?/);
    assert.deepEqual(s.chips.map((c) => c.label), ['Servicio de comida', 'Construcción y contratistas', 'Otro servicio o comercio']);
    const place = await call({ message: 'Seattle', card: s.card, asking: 'place' });
    assert.equal(place.card.values.city, 'Seattle');
    assert.match(place.reply, /Entendido\./);
    const miss = await call({ message: 'blablabla', card: s.card, asking: 'place' });
    assert.match(miss.reply, /No reconocí una ciudad de Washington/);
    // A full run to a complete card, all in Spanish.
    let card = blankCard();
    let r = await call({ message: 'Quiero abrir una panadería en Tacoma', card });
    r = await call({ message: 'sí', card: r.card });
    const answers = { structure: 'LLC', hiring: 'no', subs: 'no', salestax: 'sí', income: 'sí', tradename: 'no' };
    for (let i = 0; i < 12 && !r.complete; i += 1) {
      const field = r.ask?.field;
      if (!field) break;
      r = await call({ message: answers[field] || 'sí', card: r.card, asking: field });
    }
    assert.equal(r.complete, true);
    assert.match(r.reply, /Eso es todo lo que necesito/);
    assert.equal(r.chips[0].label, 'Guardar mi plan');
  } finally {
    await app.stop();
  }
});

test('Spanish: questions are answered from the rules with an honest note that the agency text is in English', async () => {
  const app = await startApp();
  try {
    const ask = async (message) => (await app.call('POST', '/api/intake/turn', { lang: 'es', message, card: blankCard(), asking: 'structure' })).body;
    const lic = await ask('¿Necesito una licencia comercial?');
    assert.match(lic.reply, /vienen? de las reglas y guías oficiales, que por ahora están en inglés/);
    assert.match(lic.reply, /business license/i);
    assert.ok(lic.followUp.startsWith('¿Cómo estará organizado'));
    const cases = [
      ['¿Cuánto me va a costar todo esto?', /No puedo dar un total/],
      ['¿Cuánto tiempo falta para abrir?', /10 días hábiles/],
      ['¿Eres una persona real?', /guía de inteligencia artificial/],
      ['¿Es esto un sitio oficial?', /no un sitio oficial del gobierno/i],
      ['¿Funciona en Oregon?', /solamente el estado de Washington/],
      ['¿Cómo registro una marca registrada?', /fuera de lo que cubre/],
      ['hola', /Respondo preguntas/],
      ['gracias', /De nada/],
      ['no entiendo', /No hay problema/],
      ['¿Qué es el seguro de compensación laboral?', /workers' compensation/i],
      ['¿Cómo empiezo?', /Secretary of State/i],
    ];
    for (const [q, yes] of cases) assert.match((await ask(q)).reply, yes, q);
    // English is unchanged when no language is sent.
    const en = (await app.call('POST', '/api/intake/turn', { message: 'hi', card: blankCard(), asking: 'structure' })).body;
    assert.match(en.reply, /answer questions about the steps/);
  } finally {
    await app.stop();
  }
});

test('Spanish: the side chat answers a Spanish question in Spanish, and an unknown one honestly', async () => {
  const app = await startApp();
  try {
    const ask = async (message, lang) => (await app.call('POST', '/api/chat', { message, lang })).body;
    const a = await ask('¿Necesito una licencia comercial?', 'es');
    assert.doesNotMatch(a.answer, /por ahora están en inglés/);
    assert.match(a.answer, /licencia comercial/i);
    assert.doesNotMatch(a.answer, /Who it applies to|Source checked|Not yet Approved/);
    assert.ok(a.links.every((l) => !/^Source: |^Start this step/.test(l.label)));
    const next = await ask('¿Cuál es mi siguiente paso?', 'es');
    assert.doesNotMatch(next.answer, /Next step|Confirm with/);
    const thanks = await ask('gracias', 'es');
    assert.match(thanks.answer, /De nada/);
    const en = await ask('Do I need a business license?', 'en');
    assert.doesNotMatch(en.answer, /por ahora están en inglés/);
    const none = await ask('¿Cuál es la capital de Francia?', 'es');
    assert.doesNotMatch(none.answer, /[A-Za-z]{4,} (the|of) /);
  } finally {
    await app.stop();
  }
});
