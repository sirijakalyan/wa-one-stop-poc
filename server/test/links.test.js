import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rules = JSON.parse(readFileSync(fileURLToPath(new URL('../seed/rules.json', import.meta.url)), 'utf8')).rules;
const OFFICIAL = /^https:\/\/((www\.|secure\.)?(dor|sos|lni|esd|dshs)\.wa\.gov)\//;
const urls = rules.flatMap((r) => [r.source?.url, r.apply?.url].filter(Boolean));

test('every link is https on an official Washington agency host', () => {
  for (const u of urls) assert.match(u, OFFICIAL, u);
});

test('no link is a bare agency home page', () => {
  for (const u of urls) {
    const { pathname } = new URL(u);
    assert.notEqual(pathname, '/', `bare home page: ${u}`);
  }
});

test('contractor rule uses the L&I Register as a Contractor page', () => {
  const r = rules.find((x) => x.id === 'lni-contractor');
  assert.equal(r.apply.url, 'https://lni.wa.gov/licensing-permits/contractors/register-as-a-contractor/');
});

test('DOR rules use the DOR Open a business pages', () => {
  assert.ok(rules.find((x) => x.id === 'dor').source.url.startsWith('https://dor.wa.gov/open-business'));
  assert.equal(rules.find((x) => x.id === 'dor').apply.url, 'https://secure.dor.wa.gov/home/Login');
  assert.ok(rules.find((x) => x.id === 'wizard').source.url === 'https://dor.wa.gov/open-business');
});

test('county health rule has no county link and asks the user to confirm with the county', () => {
  const r = rules.find((x) => x.id === 'health');
  assert.equal(r.apply, null);
  assert.match(r.noLink, /county health department/i);
  for (const u of urls) assert.doesNotMatch(u, /health/i, `health URL: ${u}`);
});

test('every rule with an apply link has fallback text; no em dashes', () => {
  for (const r of rules) {
    if (r.apply) assert.ok(r.fallback.length > 10, r.id);
    assert.ok(!JSON.stringify(r).includes('—'), r.id);
  }
});

test('no link points at business.wa.gov (returned 502 Bad Gateway on 2026-10-26)', () => {
  for (const u of urls) assert.doesNotMatch(u, /business\.wa\.gov/, u);
});

test('every rule has supports, limits-aware text and pending rules carry no local claims', () => {
  for (const r of rules) {
    assert.ok(r.supports && r.supports.length > 20, `${r.id} supports`);
    assert.ok(r.verification.note.length > 10, `${r.id} note`);
  }
  for (const id of ['health', 'local']) {
    const r = rules.find((x) => x.id === id);
    assert.equal(r.verification.status, 'pending', id);
    assert.equal(r.lastVerified, null, id);
  }
});

test('a rule is only Checked when it has a verified date and a note; none is Approved', () => {
  for (const r of rules) {
    if (r.verification.status === 'checked') {
      assert.ok(r.lastVerified, r.id);
      assert.ok(r.verification.note.length > 10, r.id);
      assert.ok(!/Not yet Approved|Second-person review required/.test(r.verification.note), `${r.id} note must not hard-code approval status`);
      assert.equal(r.reviewer, null, `${r.id} has no reviewer so it is not Approved`);
    }
  }
});

test('DOR sources are the current Open a business and Apply for a business license pages', () => {
  assert.ok(urls.includes('https://dor.wa.gov/open-business'));
  assert.ok(urls.includes('https://dor.wa.gov/open-business/apply-business-license'));
});

test('SOS rule applies only to entity structures, never to sole proprietors', async () => {
  const { evaluate } = await import('../src/engine.js');
  const base = { structure: 'sole', cats: [], hiring: 'no', subs: 'no', salestax: 'no', income: 'no', tradename: 'no' };
  const sole = evaluate(rules, base);
  assert.ok(!sole.items.some((i) => i.rule.id === 'sos' && i.status === 'applies'));
  const llc = evaluate(rules, { ...base, structure: 'llc' });
  assert.ok(llc.items.some((i) => i.rule.id === 'sos' && i.status === 'applies'));
});

test('action buttons use the verified entry-point URLs and accurate labels', () => {
  const by = Object.fromEntries(rules.map((r) => [r.id, r]));
  assert.equal(by.dor.apply.url, 'https://secure.dor.wa.gov/home/Login');
  assert.equal(by.dor.apply.label, 'Sign in to My DOR to apply (SAW account needed)');
  assert.equal(by.sos.apply.url, 'https://www.sos.wa.gov/corporations-charities/business-entities/start-or-register-business/start-domestic-wa-business');
  assert.equal(by.sos.apply.label, 'Start or register a Washington business');
  assert.equal(by['lni-wc'].apply.url, 'https://lni.wa.gov/insurance/insurance-requirements/how-to-get-a-workers-compensation-account');
  assert.equal(by.esd.apply.url, 'https://esd.wa.gov/employer-requirements/unemployment-taxes/employers-guide-paying-taxes');
});

test('wizard, DSHS, local, contractor and independent contractor destinations are unchanged; county health has no link', () => {
  const by = Object.fromEntries(rules.map((r) => [r.id, r]));
  assert.equal(by.wizard.apply.url, 'https://secure.dor.wa.gov/gteunauth/?Link=wiz');
  assert.equal(by.dshs.apply.url, 'https://www.dshs.wa.gov/family-food-and-housing-services/child-support/employer-resources/new-hire-reporting');
  assert.equal(by.local.apply.url, 'https://dor.wa.gov/manage-business/city-endorsements');
  assert.equal(by['lni-contractor'].apply.url, 'https://lni.wa.gov/licensing-permits/contractors/register-as-a-contractor/');
  assert.equal(by.ic.apply.url, 'https://lni.wa.gov/insurance/insurance-requirements/independent-contractors/');
  assert.equal(by.health.apply, null);
});

test('source URLs are unchanged by the action URL update', () => {
  const by = Object.fromEntries(rules.map((r) => [r.id, r.source.url]));
  assert.equal(by.sos, 'https://dor.wa.gov/open-business/choose-ownership-structure');
  assert.equal(by.dor, 'https://dor.wa.gov/open-business/apply-business-license');
  assert.equal(by['lni-wc'], 'https://lni.wa.gov/insurance/insurance-requirements/do-i-need-a-workers-comp-account/');
  assert.equal(by.esd, 'https://esd.wa.gov/employer-requirements/quarterly-reports');
});

test('ESD stays pending and is not approved; no pending rule has a reviewer', () => {
  for (const id of ['health', 'esd', 'local']) {
    const r = rules.find((x) => x.id === id);
    assert.equal(r.verification.status, 'pending', id);
    assert.equal(r.reviewer, null, id);
  }
});

test('guides match their action destinations', () => {
  const by = Object.fromEntries(rules.map((r) => [r.id, r]));
  const wc = JSON.stringify(by['lni-wc'].guide);
  assert.match(wc, /applying for, or updating, your state business license with DOR/);
  assert.match(by['lni-wc'].guide.whyExternal, /DOR business license application/);
  const esd = JSON.stringify(by.esd.guide);
  assert.match(esd, /apply for a state business license from DOR before you can file/);
  assert.match(by.esd.guide.pendingNote, /stays pending/);
  assert.match(JSON.stringify(by.dor.guide), /Secure Access Washington \(SAW\)/);
  assert.match(by.dor.guide.whyExternal, /never asks for your sign-in details/);
  assert.match(JSON.stringify(by.sos.guide), /requires a user account/);
});

test('action URLs stay on official Washington State hosts (dor, secure.dor, sos, lni, esd, dshs)', () => {
  const actions = rules.map((r) => r.apply?.url).filter(Boolean);
  for (const u of actions) assert.match(u, OFFICIAL, u);
});
