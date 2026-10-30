import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, ANSWERS } from './helpers.js';

let app;
before(async () => { app = await startApp({ adminKey: 'k-questions' }); });
after(() => app.stop());

const adm = { 'x-admin-key': 'k-questions' };
const vis = { 'x-visitor-id': 'questions-visitor-0001' };

test('only an admin can add, change or remove questions and rules; everyone can read the questions', async () => {
  assert.equal((await app.call('POST', '/api/questions', { text: 'Do you use drones?', type: 'yesno' })).status, 403);
  assert.equal((await app.call('POST', '/api/rules', { title: 'x' })).status, 403);
  assert.equal((await app.call('DELETE', '/api/rules/dor')).status, 403);
  assert.equal((await app.call('GET', '/api/questions')).body.questions.length, 0);
});

test('an admin adds a question and a rule that depends on it, and users get the new step', async () => {
  const q = await app.call('POST', '/api/questions', { text: 'Will you fly drones for work?', hint: 'Commercial drone use has extra rules.', type: 'yesno' }, adm);
  assert.equal(q.status, 200);
  const qid = q.body.question.id;
  assert.deepEqual(q.body.question.options.map((o) => o.value), ['yes', 'no', 'unsure']);
  assert.equal((await app.call('GET', '/api/questions')).body.questions[0].text, 'Will you fly drones for work?');

  const made = await app.call('POST', '/api/rules', {
    title: 'Register your drone with the FAA', agency: 'FAA', phase: 3, detail: 'Drones used for work must be registered.',
    sourceUrl: 'https://www.faa.gov/uas', applyUrl: 'https://faadronezone.faa.gov', applyLabel: 'Open FAA DroneZone',
    applies: { mode: 'when', field: `extra.${qid}`, value: 'yes' },
  }, adm);
  assert.equal(made.status, 200);
  const ruleId = made.body.rule.id;
  assert.equal(made.body.rule.verification.status, 'pending');

  const yes = await app.call('POST', '/api/checklist', { answers: { ...ANSWERS, extra: { [qid]: 'yes' } }, label: 'Drone shop' }, vis);
  const item = yes.body.items.find((i) => i.id === ruleId);
  assert.ok(item, 'the new step is on the checklist when the answer is yes');
  assert.equal(item.status, 'applies');
  assert.match(item.reason, /Will you fly drones for work/);
  assert.equal(item.apply.url, 'https://faadronezone.faa.gov');

  const no = await app.call('POST', '/api/evaluate', { answers: { ...ANSWERS, extra: { [qid]: 'no' } } });
  assert.equal(no.body.items.some((i) => i.id === ruleId), false);
  const unsure = await app.call('POST', '/api/evaluate', { answers: { ...ANSWERS, extra: { [qid]: 'unsure' } } });
  assert.equal(unsure.body.items.find((i) => i.id === ruleId)?.status, 'maybe');
  // an answer that is not one of the options is ignored
  const bad = await app.call('POST', '/api/evaluate', { answers: { ...ANSWERS, extra: { [qid]: 'banana', q_nothere: 'yes' } } });
  assert.equal(bad.body.answers.extra, undefined);

  // the question cannot be removed while a rule depends on it
  assert.equal((await app.call('DELETE', `/api/questions/${qid}`, undefined, adm)).status, 400);
  assert.equal((await app.call('DELETE', `/api/rules/${ruleId}`, undefined, adm)).status, 200);
  assert.equal((await app.call('DELETE', `/api/questions/${qid}`, undefined, adm)).status, 200);
  // history keeps a record of what was added and removed
  const changes = (await app.call('GET', '/api/changes')).body.changes;
  assert.ok(changes.some((c) => c.ruleId === ruleId));
});

test('a choice question gets its own options plus Not sure, and editing keeps existing option ids', async () => {
  const q = await app.call('POST', '/api/questions', { text: 'Where will you sell?', type: 'choice', options: ['Online', 'Storefront', 'Farmers market'] }, adm);
  assert.equal(q.status, 200);
  const opts = q.body.question.options;
  assert.deepEqual(opts.map((o) => o.label), ['Online', 'Storefront', 'Farmers market', 'Not sure']);
  const id = q.body.question.id;
  const edited = await app.call('PUT', `/api/questions/${id}`, { text: 'Where will you mainly sell?', options: [opts[0], { value: opts[1].value, label: 'A shop' }, opts[2], { label: 'At events' }] }, adm);
  assert.equal(edited.status, 200);
  const e = edited.body.question.options;
  assert.equal(e[1].value, opts[1].value);
  assert.equal(e[1].label, 'A shop');
  assert.equal(e.length, 5);
  assert.equal((await app.call('POST', '/api/questions', { text: 'x', type: 'choice', options: ['Only one'] }, adm)).status, 400);
});

test('built-in rules cannot be removed or re-aimed; custom rules need a real source link', async () => {
  assert.equal((await app.call('DELETE', '/api/rules/dor', undefined, adm)).status, 400);
  assert.equal((await app.call('PUT', '/api/rules/dor/applies', { applies: { mode: 'always' } }, adm)).status, 400);
  const base = { title: 'Test step', agency: 'Someone', phase: 1, applies: { mode: 'always' } };
  assert.equal((await app.call('POST', '/api/rules', { ...base, sourceUrl: 'http://not-secure.example' }, adm)).status, 400);
  assert.equal((await app.call('POST', '/api/rules', { ...base }, adm)).status, 400);
  const ok = await app.call('POST', '/api/rules', { ...base, sourceUrl: 'https://example.gov/page' }, adm);
  assert.equal(ok.status, 200);
  // a rule for everyone shows up for every checklist, and can be re-aimed using a built-in question
  const lists = await app.call('POST', '/api/evaluate', { answers: ANSWERS });
  assert.ok(lists.body.items.some((i) => i.id === ok.body.rule.id));
  const re = await app.call('PUT', `/api/rules/${ok.body.rule.id}/applies`, { applies: { mode: 'when', field: 'hiring', value: 'yes' } }, adm);
  assert.equal(re.status, 200);
  assert.equal(re.body.rule.version, 2);
  const none = await app.call('POST', '/api/evaluate', { answers: { ...ANSWERS, hiring: 'no' } });
  assert.equal(none.body.items.some((i) => i.id === ok.body.rule.id), false);
});
