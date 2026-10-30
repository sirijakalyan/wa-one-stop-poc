import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCognitoIdp } from '../src/cognito.js';
import { loadSecrets } from '../src/secrets.js';
import { createService } from '../src/service.js';
import { createStore } from '../src/store.js';
import { fakeCognito } from './fakeCognito.js';

function setup(opts = {}) {
  const f = fakeCognito();
  const idp = createCognitoIdp({ userPoolId: 'us-east-1_TEST', clientId: 'cid', client: f.client, verifier: f.verifier, adminEmails: ['boss@example.com'], ...opts });
  const store = createStore(mkdtempSync(path.join(tmpdir(), 'cog-')));
  const service = createService(store, { idp, adminEmails: ['boss@example.com'] });
  return { f, call: (m, p, b, ctx = {}) => service.handle(m, p, b, ctx) };
}
const STRUCT = { structure: 'llc', cats: ['food'], desc: 'cafe', city: 'Bellevue', county: 'King', hiring: 'no', subs: 'no', salestax: 'yes', income: 'yes', tradename: 'no' };

test('the app reports Cognito as the sign-in provider', async () => {
  const { call } = setup();
  const r = await call('GET', '/api/auth/config');
  assert.deepEqual([r.body.provider, r.body.needsCode], ['cognito', true]);
});

test('sign up needs the emailed code, then sign in works with the permanent password', async () => {
  const { call, f } = setup();
  const su = await call('POST', '/api/auth/signup', { name: 'Ana', email: 'Ana@Example.com', password: 'Passw0rdOK' });
  assert.equal(su.body.needsConfirm, true);
  assert.equal(su.body.token, undefined, 'no session before the email is confirmed');
  assert.equal((await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'Passw0rdOK' })).body.needsConfirm, true);
  assert.equal((await call('POST', '/api/auth/confirm', { email: 'ana@example.com', code: '000000' })).status, 400);
  assert.equal((await call('POST', '/api/auth/confirm', { email: 'ana@example.com', code: '123456' })).status, 200);
  const login = await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'Passw0rdOK' });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'user');
  assert.ok(login.body.refreshToken);
  assert.equal((await call('GET', '/api/auth/me', undefined, { session: login.body.token })).body.user.email, 'ana@example.com');
  assert.equal((await call('GET', '/api/auth/me', undefined, { session: 'x.y.z' })).body.user, null);
  assert.equal((await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'nope12345' })).status, 401);
  assert.ok(!f.client.calls.includes('AdminCreateUserCommand') && !f.client.calls.includes('AdminSetUserPasswordCommand'), 'the app never sets a temporary password');
});

test('weak password and duplicate email are refused with plain messages', async () => {
  const { call } = setup();
  assert.equal((await call('POST', '/api/auth/signup', { name: 'A', email: 'a@b.co', password: 'letters-only' })).status, 400);
  await call('POST', '/api/auth/signup', { name: 'A', email: 'a@b.co', password: 'Passw0rdOK' });
  const dup = await call('POST', '/api/auth/signup', { name: 'A', email: 'a@b.co', password: 'Passw0rdOK' });
  assert.equal(dup.status, 409);
});

test('forgot password sends a code (same answer for unknown emails) and a new permanent password works', async () => {
  const { call } = setup();
  await call('POST', '/api/auth/signup', { name: 'Ana', email: 'ana@example.com', password: 'Passw0rdOK' });
  await call('POST', '/api/auth/confirm', { email: 'ana@example.com', code: '123456' });
  const a = await call('POST', '/api/auth/forgot', { email: 'ana@example.com' });
  const b = await call('POST', '/api/auth/forgot', { email: 'nobody@example.com' });
  assert.equal(a.body.message, b.body.message);
  assert.equal((await call('POST', '/api/auth/reset', { email: 'ana@example.com', code: '111111', password: 'NewPassw0rd1' })).status, 400);
  assert.equal((await call('POST', '/api/auth/reset', { email: 'ana@example.com', code: '654321', password: 'short' })).status, 400);
  assert.equal((await call('POST', '/api/auth/reset', { email: 'ana@example.com', code: '654321', password: 'NewPassw0rd1' })).status, 200);
  assert.equal((await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'Passw0rdOK' })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'NewPassw0rd1' })).status, 200);
});

test('refresh gives a new token; a wrong refresh token is refused', async () => {
  const { call } = setup();
  await call('POST', '/api/auth/signup', { name: 'Ana', email: 'ana@example.com', password: 'Passw0rdOK' });
  await call('POST', '/api/auth/confirm', { email: 'ana@example.com', code: '123456' });
  const { body } = await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'Passw0rdOK' });
  assert.equal((await call('POST', '/api/auth/refresh', { refreshToken: body.refreshToken })).status, 200);
  assert.equal((await call('POST', '/api/auth/refresh', { refreshToken: 'bad' })).status, 401);
});

test('plans are saved per Cognito user; ADMIN_EMAILS joins the admins group; admin sees users and activity', async () => {
  const { call } = setup();
  const make = async (name, email) => {
    await call('POST', '/api/auth/signup', { name, email, password: 'Passw0rdOK' });
    await call('POST', '/api/auth/confirm', { email, code: '123456' });
    return (await call('POST', '/api/auth/login', { email, password: 'Passw0rdOK' })).body;
  };
  const ana = await make('Ana', 'ana@example.com');
  const boss = await make('Boss', 'boss@example.com');
  assert.equal(ana.user.role, 'user');
  assert.equal(boss.user.role, 'admin');
  await call('POST', '/api/checklist', { answers: STRUCT, label: 'Cafe' }, { session: ana.token });
  assert.equal((await call('GET', '/api/checklist', undefined, { session: boss.token })).body.saved, false);
  assert.equal((await call('GET', '/api/admin/users', undefined, { session: ana.token })).status, 403);
  const list = await call('GET', '/api/admin/users', undefined, { session: boss.token });
  const row = list.body.users.find((u) => u.email === 'ana@example.com');
  assert.equal(row.saved, true);
  const detail = await call('GET', `/api/admin/users/${row.id}`, undefined, { session: boss.token });
  assert.ok(detail.body.events.some((e) => e.type === 'plan-saved'));
  assert.equal((await call('POST', `/api/admin/users/${row.id}/role`, { role: 'admin' }, { session: boss.token })).status, 200);
  const again = await call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'Passw0rdOK' });
  assert.equal(again.body.user.role, 'admin');
  assert.equal((await call('POST', `/api/admin/users/${boss.user.id}/role`, { role: 'user' }, { session: boss.token })).status, 400);
});

test('Secrets Manager: loads JSON settings, never overrides real environment variables, explains a failure without leaking', async () => {
  const env = { SECRETS_ID: 'arn:aws:secretsmanager:us-east-1:111111111111:secret:wa-onestop-AbCdEf', ADMIN_KEY: 'from-env' };
  const client = { async send() { return { SecretString: JSON.stringify({ DATABASE_URL: 'postgres://x', SENDGRID_API_KEY: 'SG.fake', ADMIN_KEY: 'from-secret', EMPTY: '', NUM: 5 }) }; } };
  assert.deepEqual(await loadSecrets(env, client), { loaded: 2 });
  assert.equal(env.DATABASE_URL, 'postgres://x');
  assert.equal(env.ADMIN_KEY, 'from-env');
  assert.equal(env.EMPTY, undefined);
  assert.deepEqual(await loadSecrets({}, client), { loaded: 0 }, 'no SECRETS_ID means nothing to load');
  const broken = { async send() { throw Object.assign(new Error('secret SG.verysecret leaked'), { name: 'AccessDeniedException' }); } };
  await assert.rejects(loadSecrets({ SECRETS_ID: 'wa-onestop', AWS_REGION: 'us-east-1' }, broken), (e) => /AccessDeniedException/.test(e.message) && !/verysecret/.test(e.message));
});
