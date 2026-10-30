// Runs the Postgres store against a real PostgreSQL server.
// Uses TEST_DATABASE_URL if set, otherwise starts an embedded PostgreSQL (needs a non-root user).
// Skips with a message when neither is possible, so a plain `npm test` never fails for lack of a database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { createPool } from '../src/db/pool.js';
import { createPgStore } from '../src/db/pgStore.js';
import { ANSWERS } from './helpers.js';

let pool;
let store;
let embedded;
let dir;
let server;
let base;
let skipReason = '';

async function startDatabase() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  dir = await mkdtemp(path.join(os.tmpdir(), 'wa-pg-'));
  embedded = new EmbeddedPostgres({ databaseDir: path.join(dir, 'data'), user: 'postgres', password: 'pw', port: 54000 + Math.floor(Math.random() * 900), persistent: false, onLog: () => {}, onError: () => {} });
  await embedded.initialise();
  await embedded.start();
  await embedded.createDatabase('wa_test');
  return `postgresql://postgres:pw@localhost:${embedded.options?.port ?? embedded.port}/wa_test`;
}

before(async () => {
  try {
    const url = await startDatabase();
    pool = createPool(url);
    store = createPgStore(pool);
    await store.init();
    server = createApp({ store, adminKey: 'pg-test-key' }).listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
  } catch (err) {
    skipReason = `no PostgreSQL available (${err.message.split('\n')[0]})`;
  }
});

after(async () => {
  server?.close();
  await pool?.end().catch(() => {});
  await embedded?.stop().catch(() => {});
  if (dir) await rm(dir, { recursive: true, force: true });
});

const call = async (method, url, body, headers = {}) => {
  const res = await fetch(`${base}${url}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
};
const A = { 'x-visitor-id': 'visitor-pg-aaaa-0001' };
const B = { 'x-visitor-id': 'visitor-pg-bbbb-0002' };
const admin = { 'x-admin-key': 'pg-test-key' };

test('migration creates the tables and the seed loads 10 rules once', async (t) => {
  if (skipReason) return t.skip(skipReason);
  const tables = (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).rows.map((r) => r.table_name);
  for (const name of ['rules', 'rule_meta', 'rule_changes', 'checklists', 'notifications', 'visitor_settings', 'schema_migrations']) assert.ok(tables.includes(name), name);
  await store.init(); // second run must not duplicate or fail
  const rules = (await call('GET', '/api/rules')).body.rules;
  assert.equal(rules.length, 10);
  assert.equal((await call('GET', '/api/status')).body.storage, 'postgres');
  assert.equal(rules.find((r) => r.id === 'health').apply, null);
});

test('checklist, county, progress and renewal are saved per visitor in Postgres', async (t) => {
  if (skipReason) return t.skip(skipReason);
  await call('POST', '/api/checklist', { answers: ANSWERS, label: 'Restaurant' }, A);
  await call('POST', '/api/checklist', { answers: { ...ANSWERS, county: 'Pierce' }, label: '' }, B);
  await call('PATCH', '/api/checklist/done', { ruleId: 'sos', done: true }, A);
  await call('PUT', '/api/checklist/renewal', { ruleId: 'dor', date: '2027-03-31' }, A);
  const a = (await call('GET', '/api/checklist', undefined, A)).body;
  const b = (await call('GET', '/api/checklist', undefined, B)).body;
  assert.equal(a.answers.county, 'King');
  assert.equal(b.answers.county, 'Pierce');
  assert.match(a.items.find((i) => i.id === 'health').noLink, /You selected King County/);
  assert.match(b.items.find((i) => i.id === 'health').noLink, /You selected Pierce County/);
  assert.equal(a.items.find((i) => i.id === 'sos').done, true);
  assert.equal(b.items.find((i) => i.id === 'sos').done, false);
  assert.equal(a.items.find((i) => i.id === 'dor').renewal, '2027-03-31');
  const row = (await pool.query('SELECT answers, done FROM checklists WHERE visitor_id = $1', [A['x-visitor-id']])).rows[0];
  assert.equal(row.answers.county, 'King');
  assert.equal(row.done.sos, true);
});

test('editing answers replaces the saved checklist and resets progress', async (t) => {
  if (skipReason) return t.skip(skipReason);
  await call('POST', '/api/checklist', { answers: { ...ANSWERS, county: 'Snohomish' }, label: 'Restaurant' }, A);
  const a = (await call('GET', '/api/checklist', undefined, A)).body;
  assert.equal(a.answers.county, 'Snohomish');
  assert.equal((await pool.query('SELECT COUNT(*) AS n FROM checklists WHERE visitor_id = $1', [A['x-visitor-id']])).rows[0].n, '1');
});

test('notifications and settings are per visitor in Postgres', async (t) => {
  if (skipReason) return t.skip(skipReason);
  assert.equal((await call('PUT', '/api/settings', { emailOptIn: true, email: 'pg@example.com' }, A)).status, 200);
  await call('PUT', '/api/checklist/renewal', { ruleId: 'dor', date: '2027-03-31' }, A);
  assert.equal((await call('POST', '/api/notifications/renewal-reminder', undefined, A)).status, 200);
  const a = (await call('GET', '/api/notifications', undefined, A)).body;
  assert.equal(a.notifications.length, 1);
  assert.equal(a.emailOptIn, true);
  assert.equal(a.email, 'pg@example.com');
  assert.equal(a.emailConfirmed, false);
  // Reminder log: recorded once, never twice, removed on reset.
  assert.equal(await store.hasReminderSent(A['x-visitor-id'], 'k1'), false);
  await store.recordReminder(A['x-visitor-id'], 'k1');
  await store.recordReminder(A['x-visitor-id'], 'k1');
  assert.equal(await store.hasReminderSent(A['x-visitor-id'], 'k1'), true);
  assert.equal((await call('GET', '/api/notifications', undefined, B)).body.notifications.length, 0);
  assert.equal((await call('POST', `/api/notifications/${a.notifications[0].id}/read`, undefined, B)).status, 404);
  assert.equal((await call('POST', `/api/notifications/${a.notifications[0].id}/read`, undefined, A)).status, 200);
  assert.equal((await call('GET', '/api/notifications', undefined, A)).body.notifications[0].read, true);
});

test('admin changes persist, notify affected visitors, and survive a restart', async (t) => {
  if (skipReason) return t.skip(skipReason);
  await call('POST', '/api/checklist', { answers: ANSWERS, label: '' }, A);
  assert.equal((await call('PUT', '/api/rules/dor/draft', { fields: { detail: 'Postgres test detail.' } })).status, 403);
  assert.equal((await call('PUT', '/api/rules/dor/draft', { fields: { detail: 'Postgres test detail.' } }, admin)).status, 200);
  const pub = await call('POST', '/api/rules/dor/publish', { reviewer: 'PG reviewer' }, admin);
  assert.equal(pub.body.rule.version, 2);
  assert.equal(pub.body.queuedNotifications, 2);
  // "restart": a brand new store and app on the same database
  const store2 = createPgStore(pool);
  await store2.init();
  const doc = await store2.readRules();
  assert.equal(doc.rules.find((r) => r.id === 'dor').version, 2);
  assert.equal(doc.rules.find((r) => r.id === 'dor').detail, 'Postgres test detail.');
  assert.equal(doc.changes.length, 1);
  assert.equal(doc.changes[0].reviewer, 'PG reviewer');
  assert.equal((await store2.readRules()).rules.length, 10);
});

test('chat answers from rules stored in Postgres', async (t) => {
  if (skipReason) return t.skip(skipReason);
  const r = await call('POST', '/api/chat', { message: 'How long does the DOR business license take?' }, A);
  assert.equal(r.status, 200);
  assert.match(r.body.answer, /10 business days/);
  assert.ok(r.body.links.every((l) => l.url.startsWith('https://')));
});

test('reset restores the seed rules and clears only the caller data', async (t) => {
  if (skipReason) return t.skip(skipReason);
  assert.equal((await call('POST', '/api/demo/reset', undefined, A)).status, 403);
  assert.equal((await call('POST', '/api/demo/reset', undefined, { ...A, ...admin })).status, 200);
  const doc = await store.readRules();
  assert.equal(doc.changes.length, 0);
  assert.equal(doc.rules.find((r) => r.id === 'dor').version, 1);
  assert.equal((await call('GET', '/api/checklist', undefined, A)).body.saved, false);
  assert.equal((await call('GET', '/api/checklist', undefined, B)).body.saved, true);
});

test('migrations 002 to 004 created the evidence tables with their indexes and checks', async (t) => {
  if (skipReason) return t.skip(skipReason);
  const idx = (await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")).rows.map((r) => r.indexname);
  for (const name of ['source_reviews_rule_idx', 'source_reviews_reviewed_at_idx', 'county_sources_status_idx']) assert.ok(idx.includes(name), name);
  const applied = (await pool.query('SELECT id FROM schema_migrations ORDER BY id')).rows.map((r) => r.id);
  assert.deepEqual(applied, ['001_init.sql', '002_source_reviews.sql', '003_county_sources.sql', '004_email_reminders.sql', '005_accounts.sql']);
  await assert.rejects(pool.query("INSERT INTO source_reviews (id, rule_id, source_url, reviewed_by, result) VALUES ('x','dor','https://a.example','R','approved')"));
  await assert.rejects(pool.query("INSERT INTO county_sources (county, official_url, reviewed_by, status) VALUES ('x','https://a.example','R','approved')"));
  await store.init(); // running migrations again changes nothing
});

test('source reviews and county sources are saved in Postgres and survive a restart', async (t) => {
  if (skipReason) return t.skip(skipReason);
  const body = { ruleId: 'health', sourceUrl: 'https://kingcounty.gov/example', reviewedBy: 'PG Reviewer', result: 'pending', notes: 'Checked the page.' };
  assert.equal((await call('POST', '/api/source-reviews', body)).status, 403);
  assert.equal((await call('POST', '/api/source-reviews', body, admin)).status, 200);
  assert.equal((await call('PUT', '/api/county-sources/King%20County', { officialUrl: 'https://kingcounty.gov/example', reviewedBy: 'PG Reviewer', status: 'verified' }, admin)).status, 200);
  const store2 = createPgStore(pool);
  await store2.init();
  const reviews = await store2.listSourceReviews({ ruleId: 'health' });
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].reviewedBy, 'PG Reviewer');
  const counties = await store2.listCountySources();
  assert.equal(counties[0].county, 'king');
  assert.equal(counties[0].status, 'verified');
  assert.equal((await call('GET', '/api/source-reviews?ruleId=health')).body.reviews.length, 1);
  assert.equal((await call('GET', '/api/status')).body.data.sourceReviews, 1);
  const rule = (await call('GET', '/api/rules')).body.rules.find((r) => r.id === 'health');
  assert.equal(rule.verification.status, 'pending');
  assert.equal(rule.apply, null);
});

test('accounts, sessions, reset tokens and the activity log work in Postgres', async (t) => {
  if (skipReason) return t.skip(skipReason);
  const a = { id: 'acct1', email: 'pg@example.com', name: 'Pg', role: 'user', createdAt: new Date().toISOString(), sessions: [{ hash: 'h1', exp: Date.now() + 60000 }, { hash: 'old', exp: Date.now() - 1000 }], resetHash: 'rh', resetExp: Date.now() + 60000 };
  assert.equal(await store.createAccount(a), true);
  assert.equal(await store.createAccount({ ...a, id: 'acct2' }), false, 'email is unique');
  assert.equal((await store.findAccountByEmail('pg@example.com')).id, 'acct1');
  assert.equal((await store.findAccountBySession('h1')).id, 'acct1');
  assert.equal(await store.findAccountBySession('old'), null, 'expired session');
  assert.equal(await store.findAccountBySession('nope'), null);
  assert.equal((await store.findAccountByResetToken('rh')).id, 'acct1');
  await store.updateAccount('acct1', { role: 'admin', resetHash: '', resetExp: 0 });
  assert.equal((await store.getAccount('acct1')).role, 'admin');
  assert.equal(await store.findAccountByResetToken('rh'), null);
  await store.addEvent('acct-acct1', { at: new Date().toISOString(), type: 'signup', detail: 'x' });
  await store.addEvent('acct-acct1', { at: new Date(Date.now() + 1000).toISOString(), type: 'login', detail: 'y' });
  const ev = await store.listEvents('acct-acct1');
  assert.deepEqual(ev.map((e) => e.type), ['login', 'signup']);
  assert.equal((await store.listAccounts()).length, 1);
});
