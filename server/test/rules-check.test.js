import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, ANSWERS } from './helpers.js';

let app;
before(async () => { app = await startApp({ adminKey: 'k-check' }); });
after(() => app.stop());
const adm = { 'x-admin-key': 'k-check' };
const vis = { 'x-visitor-id': 'check-visitor-00001' };

test('an admin saves a rule edit in one step with no reviewer name, and owners are told', async () => {
  assert.equal((await app.call('PUT', '/api/rules/dor', { fields: { detail: 'x' } })).status, 403);
  await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'Shop' }, vis);
  const before = (await app.call('GET', '/api/rules?all=1', undefined, adm)).body.rules.find((r) => r.id === 'dor');
  const saved = await app.call('PUT', '/api/rules/dor', { fields: { detail: 'New plain-language detail.' } }, adm);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.changed, true);
  assert.equal(saved.body.rule.detail, 'New plain-language detail.');
  assert.equal(saved.body.rule.version, before.version + 1);
  assert.equal(saved.body.rule.draft, null);
  assert.equal(saved.body.queuedNotifications, 1);
  assert.equal((await app.call('PUT', '/api/rules/dor', { fields: { detail: 'New plain-language detail.' } }, adm)).body.changed, false, 'saving the same text changes nothing');
  assert.equal((await app.call('PUT', '/api/rules/dor', { fields: { owner: 'x' } }, adm)).status, 400);
  assert.equal(saved.body.rule.verification.status, before.verification.status, 'editing does not mark a rule as checked');
});

test('Mark as checked sets the date, logs a source review and a history line; Needs check undoes it', async () => {
  assert.equal((await app.call('POST', '/api/rules/dor/check', {})).status, 403);
  const res = await app.call('POST', '/api/rules/dor/check', { note: 'Fee still the same.' }, adm);
  assert.equal(res.status, 200);
  assert.equal(res.body.rule.verification.status, 'checked');
  assert.equal(res.body.rule.lastVerified, new Date().toISOString().slice(0, 10));
  assert.equal(res.body.rule.verification.note, 'Fee still the same.');
  const reviews = (await app.call('GET', '/api/source-reviews?ruleId=dor')).body.reviews;
  assert.equal(reviews[0].result, 'checked');
  const changes = (await app.call('GET', '/api/changes')).body.changes;
  assert.ok(changes.some((c) => c.ruleId === 'dor' && c.fields[0].field === 'verification.status' && c.fields[0].to === 'checked'));
  const back = await app.call('POST', '/api/rules/dor/check', { result: 'pending' }, adm);
  assert.equal(back.body.rule.verification.status, 'pending');
});
