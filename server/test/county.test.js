import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluate, normalizeAnswers, countyLabel } from '../src/engine.js';
import { SAMPLES } from '../src/samples.js';

const rules = JSON.parse(readFileSync(fileURLToPath(new URL('../seed/rules.json', import.meta.url)), 'utf8')).rules;
const restaurant = (extra = {}) => ({ ...SAMPLES.find((s) => s.id === 'restaurant').answers, ...extra });
const health = (answers) => evaluate(rules, answers).items.find((i) => i.rule.id === 'health');

test('county is kept by normalizeAnswers and trimmed', () => {
  assert.equal(normalizeAnswers({ county: '  King  ' }).county, 'King');
  assert.equal(normalizeAnswers({}).county, '');
  assert.equal(normalizeAnswers({ county: 42 }).county, '');
});

test('countyLabel never doubles the word County', () => {
  assert.equal(countyLabel('King'), 'King County');
  assert.equal(countyLabel('King County'), 'King County');
  assert.equal(countyLabel('  pierce COUNTY '), 'pierce County');
  assert.equal(countyLabel(''), '');
});

test('county health step names the selected county', () => {
  const item = health(restaurant({ county: 'King' }));
  assert.equal(item.noLink, 'You selected King County. Confirm food permit requirements with the King County health department. This demo has no verified link for it.');
});

test('changing the county changes the message', () => {
  assert.match(health(restaurant({ county: 'King' })).noLink, /King County health department/);
  assert.match(health(restaurant({ county: 'Pierce' })).noLink, /You selected Pierce County\. Confirm food permit requirements with the Pierce County health department/);
  assert.doesNotMatch(health(restaurant({ county: 'Pierce' })).noLink, /King/);
});

test('without a county the generic message is used', () => {
  const item = health(restaurant({ county: '' }));
  assert.match(item.noLink, /You have not entered a county/);
  assert.doesNotMatch(item.noLink, /You selected/);
});

test('a county never confirms the requirement: still pending, still no link', () => {
  const item = health(restaurant({ county: 'King' }));
  assert.equal(item.rule.verification.status, 'pending');
  assert.equal(item.rule.apply, null);
  assert.equal(item.rule.lastVerified, null);
  assert.equal(item.rule.reviewer, null);
  for (const r of rules) for (const u of [r.source?.url, r.apply?.url].filter(Boolean)) assert.doesNotMatch(u, /county.*health|health.*county|kingcounty|piercecountywa/i, u);
});

test('the county does not change which steps appear or the city logic', () => {
  const ids = (a) => evaluate(rules, a).items.map((i) => i.rule.id).join(',');
  assert.equal(ids(restaurant({ county: 'King' })), ids(restaurant()));
  const withCity = evaluate(rules, restaurant({ city: 'Bellevue', county: 'King' })).items.find((i) => i.rule.id === 'local');
  assert.match(withCity.reason, /Bellevue/);
});

test('other scenarios are unaffected by a county answer', () => {
  for (const s of SAMPLES) {
    const a = evaluate(rules, s.answers).items.map((i) => i.rule.id).join(',');
    const b = evaluate(rules, { ...s.answers, county: 'King' }).items.map((i) => i.rule.id).join(',');
    assert.equal(a, b, s.id);
  }
});
