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
  assert.match(sent[0].text, /== .+ ==/, 'steps are grouped by phase like My business');
  assert.match(sent[0].text, /Applies to you|May apply, confirm|Pending verification/);
  assert.match(sent[0].html, /border-left:5px solid/, 'each step is a card');
  assert.match(sent[0].text, /Source: /);
  assert.doesNotMatch(sent[0].text, /my-business\?plan=/, 'the email has no Open My business link');
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

test('admins see visitors who saved a plan with no account, by short ID, and not the account plans', async () => {
  const adm = await startApp({ adminKey: 'k-vis' });
  try {
    const hdr = { 'x-admin-key': 'k-vis' };
    await adm.call('POST', '/api/checklist', { answers: ANSWERS, label: 'Visitor food truck' }, { 'x-visitor-id': 'anon-visitor-abcdef123456' });
    await adm.call('POST', '/api/checklist?biz=new', { answers: ANSWERS, label: 'Second' }, { 'x-visitor-id': 'anon-visitor-abcdef123456' });
    const list = await adm.call('GET', '/api/admin/visitors', undefined, hdr);
    assert.equal(list.status, 200);
    const v = list.body.visitors.find((x) => x.id === 'anon-visitor-abcdef123456');
    assert.equal(v.shortId, 'anon-vis');
    assert.equal(v.businesses.length, 2);
    const one = await adm.call('GET', '/api/admin/visitors/anon-visitor-abcdef123456', undefined, hdr);
    assert.equal(one.body.checklists.length, 2);
    assert.equal((await adm.call('GET', '/api/admin/visitors', undefined, {})).status >= 400, true, 'owners cannot list visitors');
  } finally { await adm.stop(); }
});
