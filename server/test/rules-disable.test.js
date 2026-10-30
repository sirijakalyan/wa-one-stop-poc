import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, ANSWERS } from './helpers.js';

let app;
before(async () => { app = await startApp({ adminKey: 'k-disable' }); });
after(() => app.stop());
const adm = { 'x-admin-key': 'k-disable' };
const vis = { 'x-visitor-id': 'disable-visitor-0001' };

test('an admin can disable any rule and enable it again; owners do not see a disabled rule', async () => {
  assert.equal((await app.call('POST', '/api/rules/dor/disable')).status, 403);
  const before = await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'Shop' }, vis);
  assert.ok(before.body.items.some((i) => i.id === 'dor'), 'the built-in rule is on the checklist');
  const off = await app.call('POST', '/api/rules/dor/disable', undefined, adm);
  assert.equal(off.status, 200);
  assert.equal(off.body.rule.disabled, true);
  const pub = await app.call('GET', '/api/rules');
  assert.ok(!pub.body.rules.some((r) => r.id === 'dor'), 'public list hides it');
  const all = await app.call('GET', '/api/rules?all=1', undefined, adm);
  assert.equal(all.body.rules.find((r) => r.id === 'dor').disabled, true);
  assert.ok(!(await app.call('GET', '/api/rules?all=1')).body.rules.some((r) => r.id === 'dor'), 'only an admin gets the full list');
  const during = await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'Shop' }, vis);
  assert.ok(!during.body.items.some((i) => i.id === 'dor'), 'gone from the checklist');
  // Other admin actions keep the disabled rule.
  await app.call('POST', '/api/questions', { text: 'Any drones?', type: 'yesno' }, adm);
  assert.equal((await app.call('GET', '/api/rules?all=1', undefined, adm)).body.rules.find((r) => r.id === 'dor').disabled, true);
  const on = await app.call('POST', '/api/rules/dor/enable', undefined, adm);
  assert.equal(on.status, 200);
  assert.equal(on.body.rule.disabled, false);
  const after = await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'Shop' }, vis);
  assert.ok(after.body.items.some((i) => i.id === 'dor'), 'back on the checklist');
});
