import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';

let server; let base; let dir;
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'wa-hdr-'));
  server = createApp({ dataDir: dir }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((r) => server.close(r)); await rm(dir, { recursive: true, force: true }); });

test('security headers are set and Express is not advertised', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.match(res.headers.get('permissions-policy'), /microphone=\(self\)/);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('strict-transport-security'), null, 'no HSTS over plain HTTP');
});

test('HSTS is sent when the proxy says the request was HTTPS', async () => {
  const res = await fetch(`${base}/api/health`, { headers: { 'x-forwarded-proto': 'https' } });
  // Only trusted when trust proxy is on; default is 1, so this is honoured.
  assert.match(res.headers.get('strict-transport-security') || '', /max-age=31536000/);
});
