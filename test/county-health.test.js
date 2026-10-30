import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startApp } from './helpers.js';
import { SAMPLES } from '../src/samples.js';
import { WA_COUNTIES_FOR_TEST } from './wa-counties.js';

const pages = JSON.parse(readFileSync(fileURLToPath(new URL('../seed/county_health_candidates.json', import.meta.url)), 'utf8'));
const restaurant = SAMPLES.find((s) => s.id === 'restaurant').answers;
const KEY = 'county-test-key';
let app;
before(async () => { app = await startApp({ adminKey: KEY }); });
after(() => app.stop());

let n = 0;
async function healthFor(county, extra = {}) {
  const H = { 'x-visitor-id': `visitor-county-${String(++n).padStart(4, '0')}` };
  await app.call('POST', '/api/checklist', { answers: { ...restaurant, county, ...extra }, label: '' }, H);
  const body = (await app.call('GET', '/api/checklist', undefined, H)).body;
  return { body, item: body.items.find((i) => i.id === 'health') };
}

test('the candidate file covers all 39 Washington counties, once each, with https links or an explicit null', () => {
  assert.deepEqual(pages.counties.map((c) => c.county).sort(), [...WA_COUNTIES_FOR_TEST].sort());
  for (const c of pages.counties) assert.ok(c.url === null || /^https:\/\/[^\s]+$/.test(c.url), c.county);
  assert.ok(pages.counties.filter((c) => c.url).length >= 20);
});

test('Bellevue / King County gets the Public Health, Seattle & King County page, labelled as not yet verified', async () => {
  const { item } = await healthFor('King');
  assert.equal(item.countyHealth.state, 'found');
  assert.match(item.countyHealth.url, /^https:\/\/kingcounty\.gov\/.+food-business-permit/);
  assert.match(item.countyHealth.agency, /King County/);
  assert.equal(item.countyHealth.county, 'King County');
  assert.equal(item.verification.status, 'pending'); // a found link never makes the rule "checked"
});

test('Mason County gets its Public Health food permits page', async () => {
  const { item } = await healthFor('Mason County');
  assert.equal(item.countyHealth.state, 'found');
  assert.match(item.countyHealth.url, /masoncountywa\.gov\/departments\/public_health\/environmental_health\/food_safety\/permits\.php$/);
});

test('"King", "king county" and " KING COUNTY " all resolve to the same page', async () => {
  const urls = new Set();
  for (const c of ['King', 'king county', ' KING COUNTY ']) urls.add((await healthFor(c)).item.countyHealth.url);
  assert.equal(urls.size, 1);
});

test('a county with no page found, and an unknown county, get a clear "could not find" message and no link', async () => {
  for (const c of ['Skagit', 'Narnia']) {
    const { item } = await healthFor(c);
    assert.equal(item.countyHealth.state, 'not-found', c);
    assert.equal(item.countyHealth.url, undefined);
    assert.match(item.countyHealth.message, /We could not find an official health department page for/);
    assert.match(item.countyHealth.message, /contact the .* health department directly/);
  }
});

test('no county entered: the visitor is asked to add one, nothing is guessed', async () => {
  const { item } = await healthFor('');
  assert.equal(item.countyHealth.state, 'no-county');
  assert.match(item.countyHealth.message, /Add your county/);
  assert.equal(item.countyHealth.url, undefined);
});

test('only the health step carries county information', async () => {
  const { body } = await healthFor('King');
  for (const i of body.items) if (i.id !== 'health') assert.equal('countyHealth' in i, false, i.id);
});

test('a page verified by a person in Admin replaces the search result and names the reviewer', async () => {
  const put = await app.call('PUT', '/api/county-sources/Mason', { officialUrl: 'https://example.gov/mason-food', reviewedBy: 'Test Reviewer', status: 'verified' }, { 'x-admin-key': KEY });
  assert.equal(put.status, 200);
  const { item } = await healthFor('Mason');
  assert.equal(item.countyHealth.state, 'verified');
  assert.equal(item.countyHealth.url, 'https://example.gov/mason-food');
  assert.equal(item.countyHealth.reviewedBy, 'Test Reviewer');
  // A "pending" county source never replaces the search result.
  await app.call('PUT', '/api/county-sources/King', { officialUrl: 'https://example.gov/king-pending', reviewedBy: 'Test Reviewer', status: 'pending' }, { 'x-admin-key': KEY });
  assert.equal((await healthFor('King')).item.countyHealth.state, 'found');
});

test('a business that is not food service has no health step, so no county lookup', async () => {
  const { body } = await healthFor('King', { cats: ['other'] });
  assert.ok(!body.items.some((i) => i.id === 'health'));
});

/* ---- Extra pages found by search (ESD registration page) ---- */
const found = JSON.parse(readFileSync(fileURLToPath(new URL('../seed/found_links.json', import.meta.url)), 'utf8'));

test('found-links file: https only, each tied to a real rule id', () => {
  const ids = JSON.parse(readFileSync(fileURLToPath(new URL('../seed/rules.json', import.meta.url)), 'utf8')).rules.map((r) => r.id);
  for (const l of found.links) {
    assert.match(l.url, /^https:\/\/[^\s]+$/);
    assert.ok(ids.includes(l.ruleId), l.ruleId);
  }
});

test('the ESD card gets the registration page as an extra link, and the rule itself is untouched and still pending', async () => {
  const { body } = await healthFor('King');
  const esd = body.items.find((i) => i.id === 'esd');
  assert.equal(esd.foundLinks.length, 1);
  assert.equal(esd.foundLinks[0].url, 'https://www.esd.wa.gov/employer-taxes/register-your-business');
  assert.equal(esd.foundLinks[0].searchedOn, '2026-10-27');
  assert.equal(esd.verification.status, 'pending');
  assert.equal(esd.apply.url, 'https://esd.wa.gov/employer-requirements/unemployment-taxes/employers-guide-paying-taxes'); // the rule's own link is unchanged
  assert.equal(esd.title, 'Register for employer taxes with Employment Security');
});

test('steps without a found link carry no foundLinks field', async () => {
  const { body } = await healthFor('King');
  for (const i of body.items) if (i.id !== 'esd') assert.equal('foundLinks' in i, false, i.id);
});

test('Bellevue visitors get Bellevue city pages on the local requirements card, labelled as not yet checked; other cities do not', async () => {
  const local = async (city) => (await healthFor('King', { city })).body.items.find((i) => i.id === 'local');
  const bel = await local('Bellevue');
  assert.deepEqual(bel.foundLinks.map((l) => l.label), ['Bellevue business licenses', 'Bellevue home occupation rules', 'Bellevue permits: getting started']);
  for (const l of bel.foundLinks) assert.match(l.url, /^https:\/\/bellevuewa\.gov\//);
  assert.equal(bel.verification.status, 'pending');
  assert.equal(' bellevue '.trim().length > 0 && (await local(' BELLEVUE ')).foundLinks.length, 3); // case and spacing do not matter
  for (const other of ['Seattle', 'Belfair', '']) assert.equal('foundLinks' in (await local(other)), false, other);
});
