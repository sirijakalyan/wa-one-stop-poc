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

  // delete hides the question (it is never lost), says which rule uses it, and restore brings it back
  const del = await app.call('DELETE', `/api/questions/${qid}`, undefined, adm);
  assert.equal(del.status, 200);
  assert.deepEqual(del.body.usedBy, ['Register your drone with the FAA']);
  assert.ok(!(await app.call('GET', '/api/questions')).body.questions.some((q) => q.id === qid), 'owners are no longer asked it');
  assert.equal((await app.call('GET', '/api/questions?all=1', undefined, adm)).body.questions.find((q) => q.id === qid).hidden, true, 'admin still lists it');
  assert.ok(!(await app.call('GET', '/api/questions?all=1')).body.questions.some((q) => q.id === qid), 'only an admin gets deleted ones');
  assert.equal((await app.call('POST', `/api/questions/${qid}/restore`, undefined, adm)).status, 200);
  assert.ok((await app.call('GET', '/api/questions')).body.questions.some((q) => q.id === qid), 'asked again after restore');
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

test('a signed-in user who is not an admin cannot add, edit or remove anything', async () => {
  const email = 'plain-user@example.com';
  await app.call('POST', '/api/auth/signup', { name: 'Plain User', email, password: 'Test-pass-12345!' });
  const login = await app.call('POST', '/api/auth/login', { email, password: 'Test-pass-12345!' });
  assert.equal(login.status, 200);
  const as = { authorization: `Bearer ${login.body.token}` };
  const q = await app.call('POST', '/api/questions', { text: 'Sneaky?', type: 'yesno' }, as);
  assert.equal(q.status, 403);
  assert.equal((await app.call('PUT', '/api/questions/q_abcdef', { text: 'x' }, as)).status, 403);
  assert.equal((await app.call('DELETE', '/api/questions/q_abcdef', undefined, as)).status, 403);
  assert.equal((await app.call('POST', '/api/rules', { title: 'x', agency: 'y', phase: 1, sourceUrl: 'https://a.gov', applies: { mode: 'always' } }, as)).status, 403);
  assert.equal((await app.call('PUT', '/api/rules/dor/applies', { applies: { mode: 'always' } }, as)).status, 403);
  assert.equal((await app.call('DELETE', '/api/rules/dor', undefined, as)).status, 403);
  assert.equal((await app.call('PUT', '/api/rules/dor/draft', { fields: { detail: 'x' } }, as)).status, 403);
  assert.equal((await app.call('POST', '/api/rules/dor/publish', { reviewer: 'x' }, as)).status, 403);
  assert.equal((await app.call('GET', '/api/rule-fields', undefined, as)).status, 403);
  assert.equal((await app.call('GET', '/api/admin/users', undefined, as)).status, 403);
});

test('an admin can write Spanish text for a question and a rule, and Spanish pages show it', async () => {
  const app = await startApp({ adminKey: 'k' });
  try {
    const admin = { 'x-admin-key': 'k' };
    const q = (await app.call('POST', '/api/questions', { text: 'Will you fly drones for work?', hint: 'Extra rules apply.', type: 'yesno', es: { text: '¿Usará drones para trabajar?', hint: 'Aplican reglas adicionales.' } }, admin)).body.question;
    const es = (await app.call('GET', '/api/questions?lang=es')).body.questions[0];
    assert.equal(es.text, '¿Usará drones para trabajar?');
    assert.deepEqual(es.options.map((o) => o.label), ['Sí', 'No', 'No estoy seguro']);
    const en = (await app.call('GET', '/api/questions')).body.questions[0];
    assert.equal(en.text, 'Will you fly drones for work?');
    const rule = (await app.call('POST', '/api/rules', { title: 'Register your drone', agency: 'FAA', phase: 3, sourceUrl: 'https://www.faa.gov/uas', applyUrl: 'https://faadronezone.faa.gov', applyLabel: 'Open FAA DroneZone', applies: { mode: 'when', field: `extra.${q.id}`, value: 'yes' }, es: { title: 'Registre su dron', agency: 'FAA', applyLabel: 'Abrir FAA DroneZone' } }, admin)).body.rule;
    const rulesEs = (await app.call('GET', '/api/rules?lang=es')).body.rules.find((r) => r.id === rule.id);
    assert.equal(rulesEs.title, 'Registre su dron');
    assert.equal(rulesEs.apply.label, 'Abrir FAA DroneZone');
    const rulesEn = (await app.call('GET', '/api/rules')).body.rules.find((r) => r.id === rule.id);
    assert.equal(rulesEn.title, 'Register your drone');
    // the Spanish text can be changed later, and a built-in rule cannot be edited this way
    const saved = await app.call('PUT', `/api/rules/${rule.id}/es`, { es: { title: 'Registre su dron ante la FAA' } }, admin);
    assert.equal(saved.status, 200);
    assert.equal((await app.call('PUT', '/api/rules/dor/es', { es: { title: 'x' } }, admin)).status, 400);
  } finally {
    await app.stop();
  }
});
