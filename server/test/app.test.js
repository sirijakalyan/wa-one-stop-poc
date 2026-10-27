import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { SAMPLES } from '../src/samples.js';

let server;
let base;
let dir;

const call = async (method, url, body) => {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json(), headers: res.headers };
};

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'wa-poc-'));
  server = createApp({ dataDir: dir }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

test('health answers and carries the disclaimer', async () => {
  const r = await call('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.ok(r.headers.get('x-demo-disclaimer'));
  assert.match(r.body.disclaimer, /Demo only, not official guidance/);
});

test('status reports the storage kind and record counts', async () => {
  const r = await call('GET', '/api/status');
  assert.equal(r.body.storage, 'files');
  assert.equal(r.body.data.rules, 10);
});

test('unknown API route returns 404 JSON with the disclaimer', async () => {
  const r = await call('GET', '/api/nope');
  assert.equal(r.status, 404);
  assert.match(r.body.disclaimer, /Demo only/);
});

test('evaluate returns the restaurant checklist without saving', async () => {
  const restaurant = SAMPLES.find((s) => s.id === 'restaurant');
  const r = await call('POST', '/api/evaluate', { answers: restaurant.answers });
  assert.deepEqual(r.body.items.map((i) => i.id), ['sos', 'dor', 'wizard', 'health', 'lni-wc', 'esd', 'dshs', 'local']);
  assert.equal(r.body.saved, false);
  const saved = await call('GET', '/api/checklist');
  assert.equal(saved.body.saved, false);
});

test('saving a checklist requires a business structure', async () => {
  const r = await call('POST', '/api/checklist', { answers: {} });
  assert.equal(r.status, 400);
});

test('save, mark done, renewal date, dashboard', async () => {
  const restaurant = SAMPLES.find((s) => s.id === 'restaurant');
  const saved = await call('POST', '/api/checklist', { answers: restaurant.answers, label: restaurant.title });
  assert.equal(saved.body.items.length, 8);
  const done = await call('PATCH', '/api/checklist/done', { ruleId: 'sos', done: true });
  assert.equal(done.body.items.find((i) => i.id === 'sos').done, true);
  const renew = await call('PUT', '/api/checklist/renewal', { ruleId: 'dor', date: '2027-03-31' });
  assert.equal(renew.body.items.find((i) => i.id === 'dor').renewal, '2027-03-31');
  const bad = await call('PUT', '/api/checklist/renewal', { ruleId: 'dor', date: 'next spring' });
  assert.equal(bad.status, 400);
  const dash = await call('GET', '/api/dashboard');
  assert.equal(dash.body.done, 1);
  assert.equal(dash.body.total, 8);
  assert.equal(dash.body.next.id, 'dor');
});

test('simulated renewal reminder is created from entered dates', async () => {
  const r = await call('POST', '/api/notifications/renewal-reminder');
  assert.equal(r.body.created, 1);
  const list = await call('GET', '/api/notifications');
  assert.match(list.body.notifications[0].title, /simulated/i);
});

test('draft needs valid fields, then publish needs a reviewer and queues one notice', async () => {
  const badField = await call('PUT', '/api/rules/dor/draft', { fields: { owner: 'x' } });
  assert.equal(badField.status, 400);
  const badUrl = await call('PUT', '/api/rules/dor/draft', { fields: { 'apply.url': 'http://example.com' } });
  assert.equal(badUrl.status, 400);

  const draft = await call('PUT', '/api/rules/dor/draft', { fields: { detail: 'Updated detail text for the demo.' } });
  assert.deepEqual(Object.keys(draft.body.rule.draft), ['detail']);

  const noReviewer = await call('POST', '/api/rules/dor/publish', {});
  assert.equal(noReviewer.status, 400);

  const before = (await call('GET', '/api/notifications')).body.notifications.length;
  const pub = await call('POST', '/api/rules/dor/publish', { reviewer: 'Demo reviewer' });
  assert.equal(pub.body.rule.version, 2);
  assert.equal(pub.body.rule.draft, null);
  assert.equal(pub.body.queuedNotifications, 1);
  const after = (await call('GET', '/api/notifications')).body.notifications;
  assert.equal(after.length, before + 1);
  assert.match(after[0].title, /Rule changed/);

  const changes = await call('GET', '/api/changes');
  assert.equal(changes.body.changes[0].fields[0].field, 'detail');
});

test('publishing a rule that does not affect the saved checklist queues no notice', async () => {
  await call('PUT', '/api/rules/lni-contractor/draft', { fields: { detail: 'Changed for the test.' } });
  const before = (await call('GET', '/api/notifications')).body.notifications.length;
  const pub = await call('POST', '/api/rules/lni-contractor/publish', { reviewer: 'Demo reviewer' });
  assert.equal(pub.body.queuedNotifications, 0);
  assert.equal((await call('GET', '/api/notifications')).body.notifications.length, before);
});

test('reset restores the seed data', async () => {
  await call('POST', '/api/demo/reset');
  const rules = await call('GET', '/api/rules');
  assert.equal(rules.body.rules.find((r) => r.id === 'dor').version, 1);
  const cl = await call('GET', '/api/checklist');
  assert.equal(cl.body.saved, false);
});

test('saving a checklist keeps the county and editing it updates the county health message', async () => {
  const base = { structure: 'llc', desc: '', cats: ['food'], city: 'Bellevue', county: 'King', hiring: 'yes', subs: 'no', salestax: 'yes', income: 'yes', tradename: 'yes' };
  const saved = await call('POST', '/api/checklist', { answers: base });
  assert.equal(saved.status, 200);
  const get1 = await call('GET', '/api/checklist');
  assert.equal(get1.body.answers.county, 'King');
  assert.match(get1.body.items.find((i) => i.id === 'health').noLink, /You selected King County/);
  await call('POST', '/api/checklist', { answers: { ...base, county: 'Pierce' } });
  const get2 = await call('GET', '/api/checklist');
  assert.match(get2.body.items.find((i) => i.id === 'health').noLink, /You selected Pierce County/);
  assert.equal(get2.body.items.find((i) => i.id === 'health').apply, null);
});
