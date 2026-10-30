import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, normalizeAnswers, suggestCategories, evalCondition } from '../src/engine.js';
import { SAMPLES } from '../src/samples.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rules = JSON.parse(readFileSync(path.join(here, '..', 'seed', 'rules.json'), 'utf8')).rules;
const ids = (answers) => evaluate(rules, answers).items.map((i) => i.rule.id);
const sample = (id) => SAMPLES.find((s) => s.id === id).answers;

test('home-based sole proprietor: exact list, no Secretary of State', () => {
  assert.deepEqual(ids(sample('home')), ['dor', 'wizard', 'local']);
});

test('restaurant LLC with employees: exact ordered list', () => {
  assert.deepEqual(ids(sample('restaurant')), ['sos', 'dor', 'wizard', 'health', 'lni-wc', 'esd', 'dshs', 'local']);
});

test('construction contractor with employees: exact ordered list', () => {
  assert.deepEqual(ids(sample('contractor')), ['dor', 'wizard', 'lni-contractor', 'lni-wc', 'esd', 'dshs', 'ic', 'local']);
});

test('negative cases stay out', () => {
  const home = ids(sample('home'));
  for (const id of ['sos', 'lni-contractor', 'health', 'lni-wc', 'esd', 'dshs', 'ic']) {
    assert.ok(!home.includes(id), `${id} must not appear for the home business`);
  }
  assert.ok(!ids(sample('restaurant')).includes('lni-contractor'));
  assert.ok(!ids(sample('contractor')).includes('sos'));
});

test('"not sure" answers show items as "maybe", never as "applies"', () => {
  const a = { structure: 'unsure', hiring: 'unsure', subs: 'no', salestax: 'no', income: 'no', tradename: 'no' };
  const items = evaluate(rules, a).items;
  const by = Object.fromEntries(items.map((i) => [i.rule.id, i.status]));
  assert.equal(by.sos, 'maybe');
  assert.equal(by.dor, 'maybe');
  assert.equal(by['lni-wc'], 'maybe');
  assert.equal(by.wizard, 'applies');
});

test('no DOR trigger: license is left out with a reason pointing to the wizard', () => {
  const a = { structure: 'sole', hiring: 'no', subs: 'no', salestax: 'no', income: 'no', tradename: 'no' };
  const res = evaluate(rules, a);
  assert.ok(!res.items.some((i) => i.rule.id === 'dor'));
  const skip = res.skipped.find((s) => s.ruleId === 'dor');
  assert.match(skip.reason, /Business Licensing Wizard/);
});

test('any single DOR trigger is enough and is named in the reason', () => {
  const a = { structure: 'sole', hiring: 'no', subs: 'no', salestax: 'no', income: 'yes', tradename: 'no' };
  const dor = evaluate(rules, a).items.find((i) => i.rule.id === 'dor');
  assert.equal(dor.status, 'applies');
  assert.match(dor.reason, /\$12,000/);
});

test('the same answers always give the same result', () => {
  const a = sample('restaurant');
  assert.deepEqual(ids(a), ids({ ...a }));
});

test('items are ordered by phase, and the license comes after the Secretary of State', () => {
  const list = ids(sample('restaurant'));
  assert.ok(list.indexOf('sos') < list.indexOf('dor'));
});

test('every rule has a source link, an owner field and a verification status', () => {
  for (const r of rules) {
    assert.match(r.source.url, /^https:\/\//, `${r.id} source`);
    assert.ok(r.owner, `${r.id} owner`);
    assert.ok(['checked', 'pending'].includes(r.verification.status), `${r.id} verification`);
    if (r.verification.status === 'checked') assert.ok(r.lastVerified, `${r.id} lastVerified`);
  }
});

test('rule text contains no em dashes and no compliance claims', () => {
  const text = JSON.stringify(rules);
  assert.ok(!text.includes('—'), 'em dash found');
  assert.ok(!/\b(compliant|certified)\b/i.test(text), 'compliance claim found');
});

test('normalizeAnswers drops unknown values', () => {
  const a = normalizeAnswers({ structure: 'bogus', hiring: 'maybe', cats: ['food', 'x'], city: '  Spokane ' });
  assert.equal(a.structure, '');
  assert.equal(a.hiring, '');
  assert.deepEqual(a.cats, ['food']);
  assert.equal(a.city, 'Spokane');
});

test('keyword suggestion is simple and defaults to "other"', () => {
  assert.deepEqual(suggestCategories('Mobile dog grooming'), ['other']);
  assert.deepEqual(suggestCategories('Coffee cart and remodeling'), ['food', 'construction']);
});

test('condition combinators: all and any', () => {
  const a = { structure: 'llc', hiring: 'yes', cats: [] };
  assert.equal(evalCondition({ all: [{ field: 'structure', is: 'llc' }, { field: 'hiring', is: 'yes' }] }, a).state, 'yes');
  assert.equal(evalCondition({ all: [{ field: 'structure', is: 'llc' }, { field: 'hiring', is: 'no' }] }, a).state, 'no');
  assert.equal(evalCondition({ any: [{ field: 'hiring', is: 'no' }, { field: 'structure', is: 'llc' }] }, a).state, 'yes');
});

/* ---- Contractor registration is controlled by the business type, not by "subcontractors" ---- */
const RESTAURANT_WITH_SUBS = { structure: 'llc', desc: 'Neighborhood restaurant serving lunch and dinner', cats: ['food'], city: 'Bellevue', county: 'King', hiring: 'yes', subs: 'yes', salestax: 'yes', income: 'yes', tradename: 'yes' };

test('lni-contractor rule is conditioned only on the construction business type', () => {
  const rule = rules.find((r) => r.id === 'lni-contractor');
  assert.deepEqual(rule.applies, { field: 'cats', includes: 'construction' });
});

test('restaurant with subcontractors but no construction: contractor registration is left out with a clear reason', () => {
  const out = evaluate(rules, RESTAURANT_WITH_SUBS);
  assert.ok(!out.items.some((i) => i.rule.id === 'lni-contractor'));
  const left = out.skipped.find((s) => s.ruleId === 'lni-contractor');
  assert.match(left.reason, /did not choose construction contracting/);
  assert.match(left.reason, /Using subcontractors does not make a business a construction contractor/);
  assert.match(left.reason, /business type/);
  // Subcontractors still drive their own, separate step.
  assert.ok(out.items.some((i) => i.rule.id === 'ic'));
});

test('without subcontractors the left-out reason has no subcontractor note', () => {
  const left = evaluate(rules, { ...RESTAURANT_WITH_SUBS, subs: 'no' }).skipped.find((s) => s.ruleId === 'lni-contractor');
  assert.match(left.reason, /did not choose construction contracting/);
  assert.doesNotMatch(left.reason, /subcontractors/i);
});

test('construction contractor with subcontractors: contractor registration appears, and so does the independent-contractor review', () => {
  const out = evaluate(rules, { ...RESTAURANT_WITH_SUBS, desc: 'Home remodeling', cats: ['construction'] });
  const reg = out.items.find((i) => i.rule.id === 'lni-contractor');
  assert.equal(reg.status, 'applies');
  assert.match(reg.reason, /You chose construction contracting/);
  assert.ok(out.items.some((i) => i.rule.id === 'ic'));
  assert.ok(!out.skipped.some((s) => s.ruleId === 'lni-contractor'));
});

test('construction contractor without subcontractors still gets contractor registration', () => {
  assert.ok(ids({ ...RESTAURANT_WITH_SUBS, cats: ['construction'], subs: 'no' }).includes('lni-contractor'));
});

test('a restaurant that is also a contractor (both types chosen) gets both steps', () => {
  const got = ids({ ...RESTAURANT_WITH_SUBS, cats: ['food', 'construction'] });
  assert.ok(got.includes('lni-contractor') && got.includes('health'));
});

test('"subcontractors" in a description never suggests construction contracting', async () => {
  const { suggestCategories } = await import('../src/engine.js');
  assert.deepEqual(suggestCategories('Neighborhood restaurant. We pay subcontractors and independent contractors.'), ['food']);
  assert.deepEqual(suggestCategories('Residential remodeling and framing'), ['construction']);
});
