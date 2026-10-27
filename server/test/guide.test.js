import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluate } from '../src/engine.js';
import { SAMPLES } from '../src/samples.js';

const rules = JSON.parse(readFileSync(fileURLToPath(new URL('../seed/rules.json', import.meta.url)), 'utf8')).rules;
const ids = (answers) => evaluate(rules, answers).items.map((i) => i.rule.id);
const sample = (id) => SAMPLES.find((s) => s.id === id).answers;

test('every rule has a complete guide', () => {
  for (const r of rules) {
    const g = r.guide;
    assert.ok(g, `${r.id} guide`);
    assert.ok(g.meaning.length > 30, `${r.id} meaning`);
    assert.ok(g.who.length >= 1, `${r.id} who`);
    assert.ok(g.steps.length >= 2, `${r.id} steps`);
    assert.ok(Array.isArray(g.prepare), `${r.id} prepare`);
    if (!g.prepare.length) assert.ok(g.prepareNote !== undefined, `${r.id} prepareNote`);
  }
});

test('steps done on an agency site are explained and have an action link', () => {
  for (const r of rules) {
    if (r.guide.steps.some((s) => s.external)) {
      assert.ok(r.guide.whyExternal.length > 20, `${r.id} whyExternal`);
      assert.ok(r.apply?.url, `${r.id} apply link`);
    }
  }
});

test('health, esd and local are pending and flagged in the guide', () => {
  for (const id of ['health', 'esd', 'local']) {
    const r = rules.find((x) => x.id === id);
    assert.equal(r.verification.status, 'pending', id);
    assert.equal(r.guide.pending, true, id);
    assert.ok(r.guide.pendingNote.length > 20, id);
    assert.ok(!/^Pending verification/.test(r.guide.pendingNote), `${id} pendingNote should not repeat the status label`);
    assert.equal(r.lastVerified, null, id);
  }
  assert.match(rules.find((x) => x.id === 'local').guide.conditions.join(' '), /Bellevue/);
});

test('amounts and timing appear only as dated facts', () => {
  for (const r of rules) {
    for (const f of r.guide.facts) assert.match(f.asOf, /^\d{4}-\d\d-\d\d$/, `${r.id} ${f.label}`);
    const loose = JSON.stringify({ ...r.guide, facts: [] });
    assert.ok(!/\$\d/.test(loose.replace(/\$12,000/g, '')), `${r.id} has an undated dollar amount`);
  }
});

test('guides contain no em dashes and no compliance claims', () => {
  const t = JSON.stringify(rules.map((r) => r.guide));
  assert.ok(!t.includes('—'));
  assert.ok(!/\b(compliant|certified)\b/i.test(t));
});

test('scenario 1, home-based sole proprietor, no employees', () => {
  const got = ids(sample('home'));
  assert.deepEqual(got.sort(), ['dor', 'local', 'wizard']);
  assert.ok(!got.includes('sos') && !got.includes('lni-wc') && !got.includes('dshs'));
});

test('scenario 2, restaurant LLC with employees', () => {
  const got = ids(sample('restaurant'));
  for (const id of ['sos', 'dor', 'wizard', 'health', 'lni-wc', 'esd', 'dshs', 'local']) assert.ok(got.includes(id), id);
  assert.ok(!got.includes('lni-contractor') && !got.includes('ic'));
});

test('scenario 3, construction contractor with employees', () => {
  const got = ids(sample('contractor'));
  for (const id of ['dor', 'wizard', 'lni-contractor', 'lni-wc', 'esd', 'dshs', 'ic', 'local']) assert.ok(got.includes(id), id);
  assert.ok(!got.includes('sos') && !got.includes('health'));
});

test('applicability is rules-first: the same answers always give the same list', () => {
  const a = JSON.stringify(ids(sample('restaurant')));
  for (let i = 0; i < 5; i++) assert.equal(JSON.stringify(ids(sample('restaurant'))), a);
});

test('every displayed figure has a source title, direct URL, date checked and status', () => {
  for (const r of rules) {
    for (const f of r.guide.facts) {
      assert.ok(f.source?.label && /^https:\/\/(dor|lni|esd|www\.dshs)\.wa\.gov\//.test(f.source.url), `${r.id} ${f.label} source`);
      assert.match(f.asOf, /^\d{4}-\d\d-\d\d$/, `${r.id} ${f.label} date`);
      assert.ok(['verified', 'needs-verification'].includes(f.status), `${r.id} ${f.label} status`);
    }
  }
});

test('DOR timing keeps online, endorsement and mail estimates separate and says estimates are not guaranteed', () => {
  const r = rules.find((x) => x.id === 'dor');
  const by = Object.fromEntries(r.guide.facts.map((f) => [f.label, f]));
  assert.match(by['Online application'].text, /approximately 10 business days/);
  assert.match(by['Online application with city or state endorsements'].text, /additional 2 to 3 weeks/);
  assert.match(by['Application by mail'].text, /up to six weeks/);
  assert.equal(by['Mail with endorsements'].status, 'needs-verification');
  assert.match(r.detail, /not guaranteed/);
  assert.ok(!/\d+ (business days|weeks)/.test(r.detail), 'detail must not repeat the estimates');
});

test('L&I figures match the page read on 2026-10-26 and stages are separate', () => {
  const r = rules.find((x) => x.id === 'lni-contractor');
  const by = Object.fromEntries(r.guide.facts.map((f) => [f.label, f]));
  assert.match(by['Application fee'].text, /\$150\.20/);
  assert.match(by['Bond, general contractors'].text, /\$30,000/);
  assert.match(by['Bond, specialty contractors'].text, /\$15,000/);
  assert.match(by['General liability insurance'].text, /\$200,000.*\$50,000.*\$250,000/);
  assert.match(by['Processing and activation, mailed application'].text, /3 to 4 weeks/);
  assert.match(by['Registration card'].text, /about 2 weeks/);
  assert.match(by['Registration card'].text, /later stage/);
});

test('the disputed L&I backlog estimate is removed and marked Needs verification', () => {
  const r = rules.find((x) => x.id === 'lni-contractor');
  const all = JSON.stringify(r);
  assert.ok(!/up to 6 weeks|up to six weeks/i.test(all));
  const other = r.guide.facts.find((f) => f.label === 'Other processing times');
  assert.equal(other.status, 'needs-verification');
  assert.match(other.text, /Needs verification/);
});

test('L&I bond depends on classification and trade rules are not universal', () => {
  const c = rules.find((x) => x.id === 'lni-contractor').guide.conditions.join(' ');
  assert.match(c, /bond amount depends on classification/i);
  assert.match(c, /apply to those trades only/);
});
