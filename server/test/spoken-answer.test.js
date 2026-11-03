import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

let app;
before(async () => { app = await startApp({ adminKey: 'k-spoken' }); });
after(() => app.stop());
const turn = (body) => app.call('POST', '/api/intake/turn', body).then((r) => r.body);

test('a long spoken answer that holds a question-like phrase is still taken as the answer to the question just asked', async () => {
  let t = await turn({ card: { values: {}, status: {} }, action: 'set', field: 'structure', value: 'llp' });
  assert.equal(t.ask.field, 'activity');
  t = await turn({
    card: t.card, asking: 'activity',
    message: 'I am not focusing on the business idea but my way is like construction contracting because maybe will I can go into the construction field and I can enlarge my empathy and I was also',
  });
  assert.equal(t.card.status.activity, 'confirmed');
  assert.deepEqual(t.card.values.cats, ['construction']);
  assert.equal(t.ask.field, 'place');
  assert.doesNotMatch(t.reply, /Labor & Industries/);
});

test('a real question is still answered, even while a question is pending', async () => {
  let t = await turn({ card: { values: {}, status: {} }, action: 'set', field: 'structure', value: 'llc' });
  t = await turn({ card: t.card, asking: 'activity', message: 'What is a UBI number?' });
  assert.notEqual(t.card.status.activity, 'confirmed');
  assert.equal(t.ask.field, 'activity');
});

test('once every question is answered, a question gets "all answered, save or tell me which to change", not a lookup', async () => {
  let t = { card: { values: {}, status: {} } };
  const taps = { structure: 'gp', activity: 'other', place: '', hiring: 'unsure', subs: 'yes', salestax: 'yes', income: 'unsure', tradename: 'yes' };
  for (const [field, value] of Object.entries(taps)) t = await turn({ card: t.card, action: 'set', field, value });
  assert.equal(t.complete, true);
  for (const message of ['like tell me how to start this business two licence everything', 'What are the steps?', 'how do I register an LLC?']) {
    const r = await turn({ card: t.card, message });
    assert.equal(r.complete, true, message);
    assert.match(r.reply, /All your questions are answered\. Say or tap Save my plan\./, message);
    assert.deepEqual(r.chips.map((c) => c.value), ['save'], message);
    assert.doesNotMatch(r.reply, /Secretary of State|Labor & Industries/, message);
  }
  // Naming a question to change still reopens just that one.
  const edit = await turn({ card: t.card, message: 'I want to change the hiring answer' });
  assert.equal(edit.ask.field, 'hiring');
});
