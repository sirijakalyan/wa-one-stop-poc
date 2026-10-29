import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, ANSWERS } from './helpers.js';

let app;
before(async () => { app = await startApp(); });
after(() => app.stop());

const vis = { 'x-visitor-id': 'multi-biz-visitor-0001' };

test('one visitor can keep several businesses, switch between them and remove one', async () => {
  const first = await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'Food truck' }, vis);
  assert.equal(first.body.biz, 'main');
  const second = await app.call('POST', '/api/checklist?biz=new', { answers: { ...ANSWERS, structure: 'sole' }, label: 'Other service' }, vis);
  assert.equal(second.status, 200);
  assert.notEqual(second.body.biz, 'main');

  const list = await app.call('GET', '/api/businesses', undefined, vis);
  assert.deepEqual(list.body.businesses.map((b) => b.label), ['Food truck', 'Other service']);

  // each business keeps its own done marks
  await app.call('PATCH', `/api/checklist/done?biz=${second.body.biz}`, { ruleId: second.body.items[0].id, done: true }, vis);
  const other = await app.call('GET', `/api/checklist?biz=${second.body.biz}`, undefined, vis);
  assert.equal(other.body.items.filter((i) => i.done).length, 1);
  assert.equal((await app.call('GET', '/api/checklist', undefined, vis)).body.items.filter((i) => i.done).length, 0);

  // another visitor sees none of them
  assert.deepEqual((await app.call('GET', '/api/businesses', undefined, { 'x-visitor-id': 'someone-else-0000001' })).body.businesses, []);

  await app.call('DELETE', `/api/checklist?biz=${second.body.biz}`, undefined, vis);
  assert.deepEqual((await app.call('GET', '/api/businesses', undefined, vis)).body.businesses.map((b) => b.label), ['Food truck']);
  assert.equal((await app.call('GET', '/api/checklist?biz=bad!id', undefined, vis)).status, 404);
});
