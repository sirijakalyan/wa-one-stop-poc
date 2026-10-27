import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

let app;
before(async () => { app = await startApp({ adminKey: 'correct-horse-battery' }); });
after(() => app.stop());

const good = { 'x-admin-key': 'correct-horse-battery' };

test('admin status says a key is required and not yet authorized', async () => {
  const r = await app.call('GET', '/api/admin/status');
  assert.equal(r.body.required, true);
  assert.equal(r.body.authorized, false);
  assert.equal((await app.call('GET', '/api/admin/status', undefined, good)).body.authorized, true);
});

test('admin writes are refused without the key or with a wrong key', async () => {
  const fields = { detail: 'x' };
  assert.equal((await app.call('PUT', '/api/rules/dor/draft', { fields })).status, 403);
  assert.equal((await app.call('PUT', '/api/rules/dor/draft', { fields }, { 'x-admin-key': 'wrong' })).status, 403);
  assert.equal((await app.call('POST', '/api/rules/dor/publish', { reviewer: 'A' })).status, 403);
  assert.equal((await app.call('DELETE', '/api/rules/dor/draft')).status, 403);
  assert.equal((await app.call('POST', '/api/demo/reset')).status, 403);
});

test('the right key allows draft and publish; reading rules stays public', async () => {
  assert.equal((await app.call('GET', '/api/rules')).status, 200);
  assert.equal((await app.call('PUT', '/api/rules/dor/draft', { fields: { detail: 'Changed with the key.' } }, good)).status, 200);
  const pub = await app.call('POST', '/api/rules/dor/publish', { reviewer: 'Key holder' }, good);
  assert.equal(pub.status, 200);
  assert.equal(pub.body.rule.reviewer, 'Key holder');
});

test('the key is never echoed back in any response', async () => {
  const r = await fetch(`${app.base}/api/admin/status`, { headers: good });
  assert.doesNotMatch(await r.text(), /correct-horse-battery/);
});

test('without ADMIN_KEY in production the admin stays locked', async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const locked = await startApp({ adminKey: '' });
  process.env.NODE_ENV = prev;
  try {
    const s = await locked.call('GET', '/api/admin/status');
    assert.equal(s.body.required, true);
    assert.equal(s.body.keyConfigured, false);
    assert.equal((await locked.call('PUT', '/api/rules/dor/draft', { fields: { detail: 'x' } })).status, 403);
  } finally {
    await locked.stop();
  }
});
