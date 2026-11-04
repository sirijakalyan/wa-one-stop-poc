import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

let app;
before(async () => { app = await startApp({ adminKey: 'k' }); });
after(() => app.stop());
const key = { 'x-admin-key': 'k' };
const prep = async () => (await app.call('GET', '/api/rules')).body.rules.find((r) => r.id === 'lni-contractor').guide.prepare;

test('an admin can change "What you\'ll need" for a step, one item per line', async () => {
  const r = await app.call('PUT', '/api/rules/lni-contractor', { fields: { 'guide.prepare': '  Your UBI number \n\nYour bond certificate\n' } }, key);
  assert.equal(r.status, 200);
  assert.equal(r.body.changed, true);
  assert.deepEqual(await prep(), ['Your UBI number', 'Your bond certificate']);
});

test('saving the same list again changes nothing, and a long or huge list is refused', async () => {
  const same = await app.call('PUT', '/api/rules/lni-contractor', { fields: { 'guide.prepare': 'Your UBI number\nYour bond certificate' } }, key);
  assert.equal(same.body.changed, false);
  assert.equal((await app.call('PUT', '/api/rules/lni-contractor', { fields: { 'guide.prepare': Array(13).fill('x').join('\n') } }, key)).status, 400);
  assert.equal((await app.call('PUT', '/api/rules/lni-contractor', { fields: { 'guide.prepare': 'x'.repeat(301) } }, key)).status, 400);
});

test('owners need no key to read the list, and writing it needs the key', async () => {
  assert.equal((await app.call('PUT', '/api/rules/lni-contractor', { fields: { 'guide.prepare': 'Nope' } })).status, 403);
  assert.ok((await prep()).length >= 1);
});

test('steps now carry an official-source list: DOR, workers\' comp, ESD and city', async () => {
  const rules = (await app.call('GET', '/api/rules')).body.rules;
  for (const id of ['dor', 'lni-wc', 'esd', 'local']) assert.ok(rules.find((r) => r.id === id).guide.prepare.length >= 2, id);
});
