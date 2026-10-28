// Deterministic rules engine. No AI and no randomness.
// Each rule is a data record with an "applies" condition. The engine tests the
// owner's answers against every published rule and returns three groups:
//   applies  : the condition is true
//   maybe    : the condition could be true, but an answer was "not sure" or missing
//   no       : the condition is false (the rule is left out and the reason is kept)

export const STRUCTURE_LABELS = {
  sole: 'Sole proprietor',
  llc: 'LLC',
  corp: 'Corporation',
  partnership: 'Partnership or LLP',
  unsure: 'Structure not sure yet',
};
export const CATEGORY_LABELS = {
  food: 'Food service',
  construction: 'Construction contracting',
  other: 'Other service or retail',
};
export const YN_FIELDS = ['hiring', 'subs', 'salestax', 'income', 'tradename'];
const YN_VALUES = ['yes', 'no', 'unsure'];

// Which answers make a condition "maybe" instead of "no".
const MAYBE_ON = {
  structure: ['unsure', ''],
  hiring: ['unsure', ''],
  subs: ['unsure', ''],
  salestax: ['unsure', ''],
  income: ['unsure', ''],
  tradename: ['unsure', ''],
};

export function blankAnswers() {
  return { structure: '', desc: '', cats: [], city: '', county: '', hiring: '', subs: '', salestax: '', income: '', tradename: '' };
}

// Clean untrusted input so the engine only sees known values.
export function normalizeAnswers(input = {}) {
  const a = blankAnswers();
  if (Object.keys(STRUCTURE_LABELS).includes(input.structure)) a.structure = input.structure;
  a.desc = typeof input.desc === 'string' ? input.desc.slice(0, 500) : '';
  a.city = typeof input.city === 'string' ? input.city.trim().slice(0, 80) : '';
  a.county = typeof input.county === 'string' ? input.county.trim().slice(0, 80) : '';
  if (Array.isArray(input.cats)) {
    a.cats = [...new Set(input.cats.filter((c) => Object.keys(CATEGORY_LABELS).includes(c)))];
  }
  for (const f of YN_FIELDS) {
    if (YN_VALUES.includes(input[f])) a[f] = input[f];
  }
  return a;
}

// Simulated activity suggestion: a plain keyword match. The owner confirms or edits it.
export function suggestCategories(text = '') {
  // "subcontractors" and "independent contractors" are about who the owner pays, not a construction business.
  const t = String(text).toLowerCase().replace(/\b(sub-?contractors?|independent contractors?|contract workers?)\b/g, ' ');
  const out = [];
  if (/restaurant|cafe|coffee|food|catering|bakery|kitchen|\bbar\b|truck|diner/.test(t)) out.push('food');
  if (/construct|contractor|remodel|roof|plumb|electric|carpent|framing|build|paint|concrete/.test(t)) out.push('construction');
  if (!out.length) out.push('other');
  return out;
}

const YES = { state: 'yes', hits: [], unsure: [] };
const NO = { state: 'no', hits: [], unsure: [] };

function evalLeaf(cond, a) {
  const value = a[cond.field];
  let matched = false;
  if ('is' in cond) matched = value === cond.is;
  else if ('in' in cond) matched = cond.in.includes(value);
  else if ('includes' in cond) matched = Array.isArray(value) && value.includes(cond.includes);
  if (matched) return { state: 'yes', hits: cond.label ? [cond.label] : [], unsure: [] };
  const maybeOn = MAYBE_ON[cond.field];
  if (maybeOn && maybeOn.includes(value)) {
    return { state: 'maybe', hits: [], unsure: cond.ask ? [cond.ask] : [] };
  }
  return NO;
}

export function evalCondition(cond, a) {
  if (!cond || cond.always) return YES;
  if (cond.any) {
    const parts = cond.any.map((c) => evalCondition(c, a));
    const hits = parts.flatMap((p) => p.hits);
    const unsure = parts.flatMap((p) => p.unsure);
    if (parts.some((p) => p.state === 'yes')) return { state: 'yes', hits, unsure: [] };
    if (parts.some((p) => p.state === 'maybe')) return { state: 'maybe', hits: [], unsure };
    return NO;
  }
  if (cond.all) {
    const parts = cond.all.map((c) => evalCondition(c, a));
    if (parts.some((p) => p.state === 'no')) return NO;
    const hits = parts.flatMap((p) => p.hits);
    const unsure = parts.flatMap((p) => p.unsure);
    if (parts.some((p) => p.state === 'maybe')) return { state: 'maybe', hits, unsure };
    return { state: 'yes', hits, unsure: [] };
  }
  return evalLeaf(cond, a);
}

// "King", "king county" and "King County" all become "King County". Empty stays empty.
export function countyLabel(county) {
  const name = String(county || '').trim().replace(/\s+county$/i, '').trim();
  return name ? `${name} County` : '';
}

export function joinList(list, and = 'and') {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} ${and} ${list[list.length - 1]}`;
}

function fill(template, ctx) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, k) => (k in ctx ? ctx[k] : `{${k}}`));
}

// Extra plain-language note for a rule that was left out, when a related answer could be mistaken for its trigger.
// This only adds explanation. It never changes whether a rule applies.
const LEFT_OUT_NOTES = {
  'lni-contractor': (a) => (a.subs === 'yes'
    ? ' Using subcontractors does not make a business a construction contractor. This step depends only on the business type. Choose "Construction contracting" as the business type if that is what you do.'
    : ''),
};

import { STRUCTURE_ES, LEFT_OUT_ES } from './ruleText.es.js';

// Returns { items, skipped }. Items are sorted by phase, then rule order.
export function evaluate(rules, answers, lang = 'en') {
  const es = lang === 'es';
  const a = normalizeAnswers(answers);
  const items = [];
  const skipped = [];
  const published = rules.filter((r) => r.status === 'published');
  for (const rule of published) {
    const res = evalCondition(rule.applies, a);
    const ctx = {
      structure: (es ? STRUCTURE_ES[a.structure] : STRUCTURE_LABELS[a.structure]) || (es ? 'su estructura' : 'your structure'),
      place: a.city || (es ? 'su ciudad' : 'your city'),
      county: (es ? (a.county ? `Condado de ${String(a.county).replace(/\s+county$/i, '').trim()}` : '') : countyLabel(a.county)) || (es ? 'su condado' : 'your county'),
      countyName: String(a.county || '').replace(/\s+county$/i, '').trim() || (es ? 'su condado' : 'your county'),
      hits: joinList(res.hits, es ? 'y' : 'and'),
      unsure: joinList(res.unsure, es ? 'y' : 'and'),
    };
    if (res.state === 'no') {
      skipped.push({ ruleId: rule.id, title: rule.title, reason: fill(rule.reason?.no, ctx) + (es ? (a.subs === 'yes' ? LEFT_OUT_ES[rule.id] || '' : '') : (LEFT_OUT_NOTES[rule.id]?.(a) || '')) });
    } else {
      items.push({
        rule,
        status: res.state === 'yes' ? 'applies' : 'maybe',
        reason: fill(res.state === 'yes' ? rule.reason?.applies : rule.reason?.maybe, ctx),
        // Text shown when a step has no link. A county message is used only when the user gave a county.
        noLink: a.county && rule.noLinkCounty ? fill(rule.noLinkCounty, ctx) : fill(rule.noLink || '', ctx),
      });
    }
  }
  items.sort((x, y) => x.rule.phase - y.rule.phase || x.rule.order - y.rule.order);
  return { items, skipped };
}
