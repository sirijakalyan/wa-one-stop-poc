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
  const newcomer = { 'x-visitor-id': 'newcomer-visitor-0001' };
  const during = await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'Shop' }, newcomer);
  assert.ok(!during.body.items.some((i) => i.id === 'dor'), 'gone from a new member\'s checklist');
  assert.ok((await app.call('GET', '/api/checklist', undefined, vis)).body.items.some((i) => i.id === 'dor'), 'but kept for someone who had already saved');
  // Other admin actions keep the disabled rule.
  await app.call('POST', '/api/questions', { text: 'Any drones?', type: 'yesno' }, adm);
  assert.equal((await app.call('GET', '/api/rules?all=1', undefined, adm)).body.rules.find((r) => r.id === 'dor').disabled, true);
  const on = await app.call('POST', '/api/rules/dor/enable', undefined, adm);
  assert.equal(on.status, 200);
  assert.equal(on.body.rule.disabled, false);
  const after = await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'Shop' }, newcomer);
  assert.ok(after.body.items.some((i) => i.id === 'dor'), 'back on the checklist');
});

test('people who already saved a plan keep a disabled rule; people who save a plan afterwards do not get it', async () => {
  const early = { 'x-visitor-id': 'early-visitor-000001' };
  const late = { 'x-visitor-id': 'late-visitor-0000001' };
  await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'Early shop' }, early);
  await app.call('POST', '/api/rules/dor/disable', undefined, adm);
  const kept = await app.call('GET', '/api/checklist', undefined, early);
  assert.ok(kept.body.items.some((i) => i.id === 'dor'), 'already saved: still there');
  await app.call('POST', '/api/checklist', { answers: { ...ANSWERS, city: 'Seattle' }, label: 'Early shop edited' }, early);
  assert.ok((await app.call('GET', '/api/checklist', undefined, early)).body.items.some((i) => i.id === 'dor'), 'saving again keeps it');
  const fresh = await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'Late shop' }, late);
  assert.ok(!fresh.body.items.some((i) => i.id === 'dor'), 'new member does not get it');
  const mine = await app.call('GET', '/api/checklist', undefined, late);
  assert.ok(!mine.body.items.some((i) => i.id === 'dor'));
  await app.call('POST', '/api/rules/dor/enable', undefined, adm);
  assert.ok((await app.call('GET', '/api/checklist', undefined, late)).body.items.some((i) => i.id === 'dor'), 'enabled again: everyone has it');
});

test('saving over an existing plan answers with the kept step too', async () => {
  const v = { 'x-visitor-id': 'resave-visitor-00001' };
  await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'A' }, v);
  await app.call('POST', '/api/rules/dor/disable', undefined, adm);
  const again = await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'A again' }, v);
  assert.ok(again.body.items.some((i) => i.id === 'dor'));
  await app.call('POST', '/api/rules/dor/enable', undefined, adm);
});
