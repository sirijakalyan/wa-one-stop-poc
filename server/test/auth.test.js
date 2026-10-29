import test from 'node:test';
import assert from 'node:assert/strict';
import { createService } from '../src/service.js';
import { createStore } from '../src/store.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function setup(opts = {}) {
  const sent = [];
  const mailer = { mode: 'log', async send(m) { sent.push(m); } };
  const store = createStore(mkdtempSync(path.join(tmpdir(), 'auth-')));
  const service = createService(store, { mailer, publicUrl: 'https://example.test', adminEmails: ['boss@example.com'], ...opts });
  const call = (m, p, b, ctx = {}) => service.handle(m, p, b, ctx);
  return { sent, store, call };
}
const STRUCT = { structure: 'llc', cats: ['food'], desc: 'cafe', city: 'Bellevue', county: 'King', hiring: 'no', subs: 'no', salestax: 'yes', income: 'yes', tradename: 'no' };
const signup = (call, email = 'ana@example.com', extra = {}, ctx = {}) => call('POST', '/api/auth/signup', { name: 'Ana', email, password: 'Passw0rdOK', ...extra }, ctx);

test('sign up validates input and never returns the password hash', async () => {
  const { call } = setup();
  assert.equal((await call('POST', '/api/auth/signup', { name: '', email: 'a@b.co', password: 'Passw0rdOK' })).status, 400);
  assert.equal((await call('POST', '/api/auth/signup', { name: 'A', email: 'nope', password: 'Passw0rdOK' })).status, 400);
  assert.equal((await call('POST', '/api/auth/signup', { name: 'A', email: 'a@b.co', password: 'short1' })).status, 400);
  assert.equal((await call('POST', '/api/auth/signup', { name: 'A', email: 'a@b.co', password: 'onlyletters' })).status, 400);
  const ok = await signup(call);
  assert.equal(ok.status, 200);
  assert.match(ok.body.token, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(ok.body.user).sort(), ['email', 'id', 'name', 'role']);
  assert.equal(ok.body.user.role, 'user');
  assert.equal((await signup(call)).status, 409);
  assert.equal((await signup(call, 'ANA@example.com')).status, 409, 'email match ignores case');
});

test('session token signs in; wrong token is anonymous; logout ends the session', async () => {
  const { call } = setup();
  const { body } = await signup(call);
  assert.equal((await call('GET', '/api/auth/me', undefined, { session: body.token })).body.user.email, 'ana@example.com');
  assert.equal((await call('GET', '/api/auth/me', undefined, { session: 'f'.repeat(64) })).body.user, null);
  assert.equal((await call('GET', '/api/auth/me', undefined, {})).body.user, null);
  await call('POST', '/api/auth/logout', undefined, { session: body.token });
  assert.equal((await call('GET', '/api/auth/me', undefined, { session: body.token })).body.user, null);
});

test('login: right password works, wrong gives one generic message, five failures lock', async () => {
  const { call } = setup();
  await signup(call);
  const good = await call('POST', '/api/auth/login', { email: 'Ana@Example.com', password: 'Passw0rdOK' });
  assert.equal(good.status, 200);
  const unknown = await call('POST', '/api/auth/login', { email: 'nobody@example.com', password: 'Passw0rdOK' });
  const wrong = await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'wrongPass1' });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.body.error, wrong.body.error);
  for (let i = 0; i < 4; i += 1) await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'wrongPass1' });
  const locked = await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'Passw0rdOK' });
  assert.equal(locked.status, 429);
});

test('each account has its own plan; signed-out visitors keep theirs; the plan made before sign-up carries over', async () => {
  const { call } = setup();
  const anon = { visitor: 'anon-visitor-1' };
  assert.equal((await call('POST', '/api/checklist', { answers: STRUCT, label: 'Cafe' }, anon)).status, 200);
  const a = (await signup(call, 'ana@example.com', {}, anon)).body.token;
  const b = (await signup(call, 'ben@example.com', { name: 'Ben' }, {})).body.token;
  assert.equal((await call('GET', '/api/checklist', undefined, { session: a })).body.saved, true, 'plan carried over');
  assert.equal((await call('GET', '/api/checklist', undefined, { session: b })).body.saved, false, 'other account is separate');
  await call('DELETE', '/api/checklist', undefined, { session: a });
  assert.equal((await call('GET', '/api/checklist', undefined, anon)).body.saved, true, 'the anonymous copy is untouched');
});

test('forgot password: same answer for unknown emails, link is emailed, works once, ends old sessions', async () => {
  const { call, sent } = setup();
  const { body } = await signup(call);
  const unknown = await call('POST', '/api/auth/forgot', { email: 'nobody@example.com' });
  const known = await call('POST', '/api/auth/forgot', { email: 'ana@example.com' });
  assert.deepEqual(unknown.body.message, known.body.message);
  assert.equal(known.body.demoLink, undefined, 'a real server never shows the link on screen');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'ana@example.com');
  const token = /token=([a-f0-9]{64})/.exec(sent[0].text)[1];
  assert.match(sent[0].text, /^.*https:\/\/example\.test\/reset-password\?token=/ms);
  assert.equal((await call('POST', '/api/auth/reset', { token, password: 'short' })).status, 400);
  assert.equal((await call('POST', '/api/auth/reset', { token: 'bad', password: 'NewPassw0rd1' })).status, 400);
  assert.equal((await call('POST', '/api/auth/reset', { token, password: 'NewPassw0rd1' })).status, 200);
  assert.equal((await call('POST', '/api/auth/reset', { token, password: 'Another1Pass' })).status, 400, 'link works once');
  assert.equal((await call('GET', '/api/auth/me', undefined, { session: body.token })).body.user, null, 'old sessions end');
  assert.equal((await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'Passw0rdOK' })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'NewPassw0rd1' })).status, 200);
});

test('demo reset links only appear when the demo setting is on', async () => {
  const { call } = setup({ demoResetLinks: true, mailer: null });
  await signup(call);
  const r = await call('POST', '/api/auth/forgot', { email: 'ana@example.com' });
  assert.match(r.body.demoLink, /^\/reset-password\?token=[a-f0-9]{64}$/);
});

test('admin users: needs a real admin; lists users, shows plan progress and activity; roles', async () => {
  const { call } = setup({ adminKey: 'k3y-secret' });
  const ana = (await signup(call)).body.token;
  const boss = (await signup(call, 'boss@example.com', { name: 'Boss' })).body;
  assert.equal(boss.user.role, 'admin', 'ADMIN_EMAILS makes an admin');
  await call('POST', '/api/checklist', { answers: STRUCT, label: 'Cafe' }, { session: ana });
  const cl = (await call('GET', '/api/checklist', undefined, { session: ana })).body;
  await call('PATCH', '/api/checklist/done', { ruleId: cl.items[0].id, done: true }, { session: ana });

  assert.equal((await call('GET', '/api/admin/users', undefined, {})).status, 403);
  assert.equal((await call('GET', '/api/admin/users', undefined, { session: ana })).status, 403);
  const list = await call('GET', '/api/admin/users', undefined, { session: boss.token });
  assert.equal(list.status, 200);
  const row = list.body.users.find((u) => u.email === 'ana@example.com');
  assert.equal(row.saved, true);
  assert.equal(row.done, 1);
  assert.ok(row.total >= 1);
  assert.equal(JSON.stringify(list.body).includes('passHash'), false);

  const detail = await call('GET', `/api/admin/users/${row.id}`, undefined, { adminKey: 'k3y-secret' });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.checklist.answers.city, 'Bellevue');
  assert.equal(detail.body.checklist.items.filter((i) => i.done).length, 1);
  const types = detail.body.events.map((e) => e.type);
  for (const t of ['signup', 'plan-saved', 'step-done']) assert.ok(types.includes(t), t);
  assert.equal(JSON.stringify(detail.body).includes('passHash'), false);

  assert.equal((await call('POST', `/api/admin/users/${row.id}/role`, { role: 'admin' }, { session: boss.token })).status, 200);
  assert.equal((await call('GET', '/api/admin/users', undefined, { session: ana })).status, 200);
  assert.equal((await call('POST', `/api/admin/users/${boss.user.id}/role`, { role: 'user' }, { session: boss.token })).status, 400, 'cannot demote yourself');
});

test('an admin account can edit rules without the admin key', async () => {
  const { call } = setup({ adminKey: 'k3y-secret' });
  const boss = (await signup(call, 'boss@example.com', { name: 'Boss' })).body.token;
  const rules = (await call('GET', '/api/rules')).body.rules;
  const draft = { 'apply.url': 'https://example.gov/new' };
  assert.equal((await call('PUT', `/api/rules/${rules[0].id}/draft`, { fields: draft }, {})).status, 403);
  assert.equal((await call('PUT', `/api/rules/${rules[0].id}/draft`, { fields: draft }, { session: boss })).status, 200);
});

test('reminders go to the account email from the first sign in, with no form and no confirmation; stopping sticks', async () => {
  const { call, sent } = setup();
  await signup(call, 'ana@example.com');
  const login = () => call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'Passw0rdOK' });
  const H = (token) => ({ session: token });
  const t1 = (await login()).body.token;
  const n1 = (await call('GET', '/api/notifications', null, H(t1))).body;
  assert.equal(n1.accountEmail, 'ana@example.com');
  assert.deepEqual([n1.emailOptIn, n1.emailConfirmed, n1.email], [true, true, 'ana@example.com']);
  assert.equal(sent.length, 0, 'no confirmation email is sent');
  // the person stops the emails; signing in again does not turn them back on
  const off = await call('PUT', '/api/settings', { emailOptIn: false }, H(t1));
  assert.equal(off.body.emailOptIn, false);
  const t2 = (await login()).body.token;
  assert.equal((await call('GET', '/api/notifications', null, H(t2))).body.emailOptIn, false);
  // one click turns them on again, using the account address and no confirmation email
  const on = await call('PUT', '/api/settings', { emailOptIn: true }, H(t2));
  assert.deepEqual([on.body.emailOptIn, on.body.emailConfirmed, on.body.email], [true, true, 'ana@example.com']);
  assert.equal(sent.length, 0);
});
