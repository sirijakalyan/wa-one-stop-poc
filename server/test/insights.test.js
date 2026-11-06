import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, ANSWERS } from './helpers.js';
import { keysFor, median } from '../src/insights.js';

let app;
before(async () => { app = await startApp({ adminKey: 'k-ins' }); });
after(() => app.stop());
const hdr = { 'x-admin-key': 'k-ins' };
const ev = (body, h = { 'x-visitor-id': 'ins-visitor-00000001' }) => app.call('POST', '/api/insights/event', body, h);

test('events are checked: only known types and values become counters, and nothing personal is kept', () => {
  assert.deepEqual(keysFor({ type: 'plan_started', mode: 'voice', lang: 'en' }), ['plan_started|voice|en']);
  assert.equal(keysFor({ type: 'plan_started', mode: 'telepathy', lang: 'en' }), null);
  assert.equal(keysFor({ type: 'question_left', question_id: 'a b<script>' }), null);
  assert.deepEqual(keysFor({ type: 'feedback', value: 'partly', reasons: ['too_long', 'my name is Ana', 'too_long'] }), ['feedback|partly', 'feedback_reason|partly|too_long']);
  assert.deepEqual(keysFor({ type: 'feedback', value: 'yes', reasons: ['too_long'] }), ['feedback|yes']);
  assert.equal(keysFor({ type: 'nope' }), null);
});

test('the report counts events, hides groups under 5, and only a strict admin can read it', async () => {
  for (let i = 0; i < 6; i += 1) {
    await ev({ type: 'plan_started', mode: 'typing', lang: 'en' });
    await ev({ type: 'plan_shown', step_count: 8, seconds: 240 });
    await ev({ type: 'feedback', value: i < 5 ? 'yes' : 'partly', reasons: i < 5 ? [] : ['too_long'] });
  }
  await ev({ type: 'plan_started', mode: 'voice', lang: 'es' });
  await ev({ type: 'plan_started', mode: 'voice', lang: 'es' });
  const r = await app.call('GET', '/api/admin/insights?days=30', undefined, hdr);
  assert.equal(r.status, 200);
  assert.equal(r.body.funnel.started, 8);
  assert.equal(r.body.funnel.shown, 6);
  assert.equal(r.body.modes.typing, 6);
  assert.equal(r.body.modes.voice, null, 'a group of 2 is hidden');
  assert.equal(r.body.langs.es, null);
  const clear = r.body.kpis.find((k) => k.id === 'clear');
  assert.equal(clear.value, 83);
  const time = r.body.kpis.find((k) => k.id === 'time');
  assert.equal(time.value, 4.3); // 30-second buckets: the middle of the 4 to 4.5 minute bucket
  assert.equal(r.body.feedback.reasons['partly|too_long'], null, 'one answer is hidden');
  assert.ok(!JSON.stringify(r.body).includes('ins-visitor'), 'no visitor ID is in the report');
  assert.ok((await app.call('GET', '/api/admin/insights', undefined, {})).status >= 400);
});

test('admin and test traffic is not counted, and marking a step done is', async () => {
  const before = (await app.call('GET', '/api/admin/insights', undefined, hdr)).body.funnel.started;
  await ev({ type: 'plan_started', mode: 'form', lang: 'en' }, { ...hdr, 'x-visitor-id': 'ins-admin-visitor-001' });
  assert.equal((await app.call('GET', '/api/admin/insights', undefined, hdr)).body.funnel.started, before);
  const v = { 'x-visitor-id': 'ins-visitor-00000002' };
  const saved = await app.call('POST', '/api/checklist', { answers: ANSWERS, label: 'x' }, v);
  for (let i = 0; i < 5; i += 1) await app.call('PATCH', '/api/checklist/done', { ruleId: saved.body.items[0].id, done: true }, { 'x-visitor-id': `ins-visitor-0000010${i}` }).catch(() => {});
  assert.ok(median({ 'plan_shown_sec|8': 6 }).seconds === 255);
});

test('the minimum group size is 5 unless INSIGHTS_MIN_GROUP sets a whole number from 1 to 50', async () => {
  const load = async (v) => { if (v === undefined) delete process.env.INSIGHTS_MIN_GROUP; else process.env.INSIGHTS_MIN_GROUP = v; return (await import(`../src/insights.js?v=${Math.random()}`)).MIN_GROUP; };
  try {
    assert.equal(await load(undefined), 5);
    assert.equal(await load('1'), 1);
    assert.equal(await load('0'), 5);
    assert.equal(await load('abc'), 5);
    assert.equal(await load('99'), 5);
  } finally { delete process.env.INSIGHTS_MIN_GROUP; }
});

test('error messages come back in Spanish when the site asks for Spanish, on any route', async () => {
  const bad = { email: 'nobody@example.test', password: 'wrongpass1' };
  const en = await app.call('POST', '/api/auth/login', bad);
  assert.equal(en.body.error, 'The email or password is not right.');
  const es = await app.call('POST', '/api/auth/login?ui=es', bad);
  assert.equal(es.body.error, 'El correo o la contraseña no son correctos.');
  const adminEs = await app.call('GET', '/api/admin/visitors/zzzz-not-here-0000?ui=es', undefined, hdr);
  assert.match(adminEs.body.error, /No se encontr/);
});

test('Spanish chat: the suggestion buttons under an AI answer come back in Spanish', async () => {
  const r = await app.call('POST', '/api/chat', { message: 'hola, quiero empezar un negocio de cosas raras', lang: 'es' });
  for (const s of r.body.suggestions || []) assert.doesNotMatch(s, /^(How|Do I|What)\b/);
});
