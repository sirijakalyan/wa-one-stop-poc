import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

let app;
before(async () => { app = await startApp({ adminKey: 'evidence-key' }); });
after(() => app.stop());

const admin = { 'x-admin-key': 'evidence-key' };
const review = { ruleId: 'health', sourceUrl: 'https://kingcounty.gov/example-page', reviewedBy: 'Reviewer One', result: 'pending', notes: 'Page opened. Not yet matched to the rule.' };

test('source reviews and county sources start empty and are readable without the key', async () => {
  assert.deepEqual((await app.call('GET', '/api/source-reviews')).body.reviews, []);
  assert.deepEqual((await app.call('GET', '/api/county-sources')).body.counties, []);
});

test('writes need the admin key', async () => {
  assert.equal((await app.call('POST', '/api/source-reviews', review)).status, 403);
  assert.equal((await app.call('PUT', '/api/county-sources/King', { officialUrl: 'https://x.example/a', reviewedBy: 'R', status: 'verified' })).status, 403);
});

test('a source review is recorded, listed newest first, and filtered by rule', async () => {
  const r = await app.call('POST', '/api/source-reviews', review, admin);
  assert.equal(r.status, 200);
  assert.equal(r.body.review.result, 'pending');
  await app.call('POST', '/api/source-reviews', { ...review, ruleId: 'dor', sourceUrl: 'https://dor.wa.gov/open-business', result: 'checked', notes: '' }, admin);
  const all = (await app.call('GET', '/api/source-reviews')).body.reviews;
  assert.equal(all.length, 2);
  assert.equal(all[0].ruleId, 'dor');
  const only = (await app.call('GET', '/api/source-reviews?ruleId=health')).body.reviews;
  assert.equal(only.length, 1);
  assert.equal(only[0].reviewedBy, 'Reviewer One');
  assert.ok(only[0].reviewedAt);
});

test('recording a review never changes a rule status, approval or version', async () => {
  const before = (await app.call('GET', '/api/rules')).body.rules.find((x) => x.id === 'health');
  await app.call('POST', '/api/source-reviews', { ...review, result: 'checked' }, admin);
  const after = (await app.call('GET', '/api/rules')).body.rules.find((x) => x.id === 'health');
  assert.equal(after.verification.status, before.verification.status);
  assert.equal(after.reviewer, before.reviewer);
  assert.equal(after.version, before.version);
  assert.equal(after.apply, null);
});

test('source review validation', async () => {
  const bad = async (patch) => (await app.call('POST', '/api/source-reviews', { ...review, ...patch }, admin)).status;
  assert.equal(await bad({ ruleId: 'nope' }), 400);
  assert.equal(await bad({ sourceUrl: 'http://insecure.example' }), 400);
  assert.equal(await bad({ sourceUrl: 'javascript:alert(1)' }), 400);
  assert.equal(await bad({ reviewedBy: '' }), 400);
  assert.equal(await bad({ result: 'approved' }), 400);
  assert.equal(await bad({ notes: 'x'.repeat(1001) }), 400);
});

test('a county source is saved under a normalized county name and can be updated', async () => {
  const body = { officialUrl: 'https://kingcounty.gov/example-page', reviewedBy: 'Reviewer One', status: 'pending' };
  assert.equal((await app.call('PUT', '/api/county-sources/King%20County', body, admin)).body.county.county, 'king');
  await app.call('PUT', '/api/county-sources/king', { ...body, status: 'verified', reviewedBy: 'Reviewer Two' }, admin);
  await app.call('PUT', '/api/county-sources/Pierce', { ...body, officialUrl: 'https://example.org/pierce' }, admin);
  const list = (await app.call('GET', '/api/county-sources')).body.counties;
  assert.deepEqual(list.map((c) => c.county), ['king', 'pierce']);
  assert.equal(list[0].status, 'verified');
  assert.equal(list[0].reviewedBy, 'Reviewer Two');
});

test('county source validation', async () => {
  const ok = { officialUrl: 'https://kingcounty.gov/x', reviewedBy: 'R', status: 'verified' };
  assert.equal((await app.call('PUT', '/api/county-sources/King', { ...ok, officialUrl: 'ftp://x' }, admin)).status, 400);
  assert.equal((await app.call('PUT', '/api/county-sources/King', { ...ok, status: 'approved' }, admin)).status, 400);
  assert.equal((await app.call('PUT', '/api/county-sources/King', { ...ok, reviewedBy: '' }, admin)).status, 400);
  assert.equal((await app.call('PUT', '/api/county-sources/1;DROP', ok, admin)).status, 400);
});

test('a verified county source does not change the checklist: the health step stays pending with no link', async () => {
  const h = { 'x-visitor-id': 'visitor-evidence-0001' };
  await app.call('POST', '/api/checklist', { answers: { structure: 'llc', desc: '', cats: ['food'], city: '', county: 'King', hiring: 'yes', subs: 'no', salestax: 'yes', income: 'yes', tradename: 'yes' } }, h);
  const item = (await app.call('GET', '/api/checklist', undefined, h)).body.items.find((i) => i.id === 'health');
  assert.equal(item.verification.status, 'pending');
  assert.equal(item.apply, null);
});
