import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, ANSWERS } from './helpers.js';

let app;
before(async () => { app = await startApp(); });
after(() => app.stop());

const A = { 'x-visitor-id': 'visitor-aaaaaaaa-0001' };
const B = { 'x-visitor-id': 'visitor-bbbbbbbb-0002' };

test('each browser id sees only its own checklist', async () => {
  await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'A business' }, A);
  assert.equal((await app.call('GET', '/api/checklist', undefined, A)).body.saved, true);
  assert.equal((await app.call('GET', '/api/checklist', undefined, B)).body.saved, false);
  await app.call('POST', '/api/checklist', { answers: { ...ANSWERS, county: 'Pierce' }, label: 'B business' }, B);
  const a = (await app.call('GET', '/api/checklist', undefined, A)).body;
  const b = (await app.call('GET', '/api/checklist', undefined, B)).body;
  assert.equal(a.answers.county, 'King');
  assert.equal(b.answers.county, 'Pierce');
  assert.equal(a.label, 'A business');
});

test('progress ticks and renewal dates stay with their visitor', async () => {
  await app.call('PATCH', '/api/checklist/done', { ruleId: 'sos', done: true }, A);
  await app.call('PUT', '/api/checklist/renewal', { ruleId: 'dor', date: '2027-03-31' }, A);
  const a = (await app.call('GET', '/api/checklist', undefined, A)).body;
  const b = (await app.call('GET', '/api/checklist', undefined, B)).body;
  assert.equal(a.items.find((i) => i.id === 'sos').done, true);
  assert.equal(a.items.find((i) => i.id === 'dor').renewal, '2027-03-31');
  assert.equal(b.items.find((i) => i.id === 'sos').done, false);
  assert.equal(b.items.find((i) => i.id === 'dor').renewal, null);
});

test('notifications and the email setting are per visitor', async () => {
  await app.call('PUT', '/api/settings', { emailOptIn: true }, A);
  const r = await app.call('POST', '/api/notifications/renewal-reminder', undefined, A);
  assert.equal(r.status, 200);
  assert.equal((await app.call('GET', '/api/notifications', undefined, A)).body.notifications.length, 1);
  const b = (await app.call('GET', '/api/notifications', undefined, B)).body;
  assert.equal(b.notifications.length, 0);
  assert.equal(b.emailOptIn, false);
  const id = (await app.call('GET', '/api/notifications', undefined, A)).body.notifications[0].id;
  assert.equal((await app.call('POST', `/api/notifications/${id}/read`, undefined, B)).status, 404);
  assert.equal((await app.call('POST', `/api/notifications/${id}/read`, undefined, A)).status, 200);
});

test('deleting one visitor checklist leaves the other', async () => {
  await app.call('DELETE', '/api/checklist', undefined, A);
  assert.equal((await app.call('GET', '/api/checklist', undefined, A)).body.saved, false);
  assert.equal((await app.call('GET', '/api/checklist', undefined, B)).body.saved, true);
});

test('a rule change notifies every visitor whose checklist includes the rule', async () => {
  await app.call('POST', '/api/checklist', { answers: ANSWERS, label: '' }, A);
  await app.call('PUT', '/api/rules/dor/draft', { fields: { detail: 'Updated detail for the visitors test.' } });
  const pub = await app.call('POST', '/api/rules/dor/publish', { reviewer: 'Test reviewer' });
  assert.equal(pub.body.queuedNotifications, 2);
  for (const h of [A, B]) {
    const n = (await app.call('GET', '/api/notifications', undefined, h)).body.notifications;
    assert.ok(n.some((x) => /Rule changed/.test(x.title)));
  }
});

test('an invalid visitor id falls back to the shared public-demo visitor', async () => {
  await app.call('POST', '/api/checklist', { answers: ANSWERS }, { 'x-visitor-id': '../../etc' });
  assert.equal((await app.call('GET', '/api/checklist')).body.saved, true);
  assert.equal((await app.call('GET', '/api/checklist', undefined, { 'x-visitor-id': 'x' })).body.saved, true);
});

test('reset restores rules and clears only the caller data', async () => {
  const r = await app.call('POST', '/api/demo/reset', undefined, A);
  assert.equal(r.status, 200);
  assert.equal((await app.call('GET', '/api/checklist', undefined, A)).body.saved, false);
  assert.equal((await app.call('GET', '/api/checklist', undefined, B)).body.saved, true);
  assert.equal((await app.call('GET', '/api/changes')).body.changes.length, 0);
});

test('saved answers keep the business type and the subcontractor answer separate all the way to the checklist', async () => {
  const H = { 'x-visitor-id': 'visitor-cats-0003' };
  const base = { structure: 'llc', desc: '', city: 'Bellevue', county: 'King', hiring: 'yes', subs: 'yes', salestax: 'yes', income: 'yes', tradename: 'yes' };
  const rest = (await app.call('POST', '/api/checklist', { answers: { ...base, cats: ['food'] }, label: '' }, H)).body;
  assert.deepEqual(rest.answers.cats, ['food']);
  assert.equal(rest.answers.subs, 'yes');
  assert.ok(!rest.items.some((i) => i.id === 'lni-contractor'));
  assert.match(rest.skipped.find((s) => s.ruleId === 'lni-contractor').reason, /Using subcontractors does not make/);
  assert.deepEqual((await app.call('GET', '/api/checklist', undefined, H)).body.answers.cats, ['food']);
  const con = (await app.call('POST', '/api/checklist', { answers: { ...base, cats: ['construction'] }, label: '' }, H)).body;
  assert.deepEqual(con.answers.cats, ['construction']);
  assert.ok(con.items.some((i) => i.id === 'lni-contractor'));
});
