import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, ANSWERS } from './helpers.js';

const sent = [];
let app;
before(async () => { app = await startApp({ mailer: { mode: 'live', async send(m) { sent.push(m); } }, publicUrl: 'https://example.test' }); });
after(() => app.stop());
const vis = { 'x-visitor-id': 'plan-email-visitor-001' };

test('Email me a link sends the steps and a My business link that rebuilds the plan, and saves nothing', async () => {
  const r = await app.call('POST', '/api/plan/email', { email: 'owner@example.com', answers: ANSWERS, label: 'Food truck' }, vis);
  assert.equal(r.status, 200);
  assert.equal(r.body.sent, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'owner@example.com');
  assert.match(sent[0].text, /1\. /);
  const m = /https:\/\/example\.test\/my-business\?plan=([A-Za-z0-9_-]+)/.exec(sent[0].text);
  assert.ok(m, 'the email has the link');
  const back = JSON.parse(Buffer.from(m[1], 'base64url').toString());
  assert.equal(back.a.structure, ANSWERS.structure);
  assert.equal(back.l, 'Food truck');
  assert.equal((await app.call('GET', '/api/businesses', undefined, vis)).body.businesses.length, 0);
});

test('a bad email address is refused, and too many requests are slowed down', async () => {
  const bad = await app.call('POST', '/api/plan/email', { email: 'nope', answers: ANSWERS }, vis);
  assert.equal(bad.status, 400);
  const other = { 'x-visitor-id': 'plan-email-visitor-002' };
  let last;
  for (let i = 0; i < 6; i += 1) last = await app.call('POST', '/api/plan/email', { email: 'a@example.com', answers: ANSWERS }, other);
  assert.equal(last.status, 429);
});
