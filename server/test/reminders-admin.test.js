import { test, before, after } from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.js';
import assert from 'node:assert/strict';
import { startApp, ANSWERS } from './helpers.js';
import { localParts } from '../src/service.js';

const sent = [];
const mailer = { mode: 'live', async send(m) { sent.push(m); } };
let app;
let store;
const ADMIN = { 'x-admin-key': 'k' };
before(async () => {
  store = createStore(await mkdtemp(path.join(os.tmpdir(), 'wa-rem-')));
  app = await startApp({ mailer, store, adminKey: 'k', publicUrl: 'http://api.test' });
});
after(() => app.stop());

test('only an admin can read or change the reminder schedule', async () => {
  assert.equal((await app.call('GET', '/api/admin/reminders')).status, 403);
  assert.equal((await app.call('PUT', '/api/admin/reminders', { windows: [7], sendHour: 9, timezone: 'UTC' })).status, 403);
});

test('starts with 30, 14, 7 and 1 days at 9:00 AM Pacific', async () => {
  const r = await app.call('GET', '/api/admin/reminders', undefined, ADMIN);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.config, { windows: [30, 14, 7, 1], sendHour: 9, timezone: 'America/Los_Angeles' });
  assert.ok(r.body.zones.length >= 4);
});

test('saving validates, sorts the days, and records who changed what', async () => {
  const bad = (body) => app.call('PUT', '/api/admin/reminders', body, ADMIN);
  assert.equal((await bad({ windows: [], sendHour: 9, timezone: 'UTC' })).status, 400);
  assert.equal((await bad({ windows: [7, -1], sendHour: 9, timezone: 'UTC' })).status, 400);
  assert.equal((await bad({ windows: [7.5], sendHour: 9, timezone: 'UTC' })).status, 400);
  assert.equal((await bad({ windows: [400], sendHour: 9, timezone: 'UTC' })).status, 400);
  assert.equal((await bad({ windows: [1, 2, 3, 4, 5, 6, 7, 8, 9], sendHour: 9, timezone: 'UTC' })).status, 400);
  assert.equal((await bad({ windows: [7], sendHour: 24, timezone: 'UTC' })).status, 400);
  assert.equal((await bad({ windows: [7], sendHour: 9, timezone: 'Mars/Base' })).status, 400);
  const ok = await bad({ windows: [1, 60, 7, 7], sendHour: 8, timezone: 'America/New_York' });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.config, { windows: [60, 7, 1], sendHour: 8, timezone: 'America/New_York' });
  assert.equal(ok.body.changed, true);
  const again = (await app.call('GET', '/api/admin/reminders', undefined, ADMIN)).body;
  assert.deepEqual(again.config.windows, [60, 7, 1]);
  assert.match(again.history[0].summary, /days 30, 14, 7, 1 to 60, 7, 1/);
  assert.match(again.history[0].summary, /send time 9:00 AM to 8:00 AM/);
  // Saving the same thing again changes nothing and adds no history line.
  const same = await bad({ windows: [60, 7, 1], sendHour: 8, timezone: 'America/New_York' });
  assert.equal(same.body.changed, false);
  assert.equal(same.body.history.length, again.history.length);
});

test('the new days drive the emails, and the hourly run waits for the chosen hour', async () => {
  await app.call('PUT', '/api/admin/reminders', { windows: [60, 7, 1], sendHour: 9, timezone: 'UTC' }, ADMIN);
  const svc = app.service;
  const V = { 'x-visitor-id': 'rem-admin-1' };
  await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'Cafe' }, V);
  // Make the owner a confirmed subscriber without going through email confirmation.
  await store.putSettings('rem-admin-1', { emailOptIn: true, email: 'o@example.com', emailConfirmed: true, emailToken: 'tok123' });
  const ruleId = (await app.call('GET', '/api/checklist', undefined, V)).body.items[0].id;
  const date = localParts(new Date(Date.now() + 40 * 86400000), 'UTC').date; // 40 days away: inside 60, outside 30
  await app.call('PUT', '/api/checklist/renewal', { ruleId, date }, V);
  const sentBefore = sent.length;
  // Before 9:00 UTC the hourly run (atSendTime) sends nothing. After 9:00 it sends.
  const early = new Date(`${localParts(new Date(), 'UTC').date}T05:00:00Z`);
  const late = new Date(`${localParts(new Date(), 'UTC').date}T10:00:00Z`);
  assert.equal((await svc.runReminders(early, 'rem-admin-1', { atSendTime: true })).sent, 0);
  assert.equal(sent.length, sentBefore);
  const r = await svc.runReminders(late, 'rem-admin-1', { atSendTime: true });
  assert.equal(r.sent, 1, 'one email for the 60 day point');
  assert.match(sent[sent.length - 1].subject, /in 40 days/);
  assert.equal((await svc.runReminders(late, 'rem-admin-1', { atSendTime: true })).sent, 0, 'the same point is not sent twice');
});

test('a test email goes to the signed-in admin only', async () => {
  const noAccount = await app.call('POST', '/api/admin/reminders/test', {}, ADMIN);
  assert.equal(noAccount.status, 400);
  assert.match(noAccount.body.error || noAccount.body.message || '', /Sign in/);
});
