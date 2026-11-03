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
