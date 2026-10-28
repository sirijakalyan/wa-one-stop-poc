// Turns the English rule records into Spanish for display. The English records stay the source of truth: a Spanish entry is used
// only while the rule is still at the version it was written for, and any field it lacks stays in English.
import { SOURCE_LABEL_ES, RULES_ES, PHASES_ES, COND_ES, AGENCY_ES, FOUND_ES, COUNTY_NOTE_ES, TIMES_ES, SIMULATION_ES, TIMELINE_ES } from './ruleText.es.js';

const isEs = (lang) => lang === 'es';

// A translated list replaces the English one only when it has the same number of entries.
const sameLen = (en, es) => (Array.isArray(en) && Array.isArray(es) && en.length === es.length ? es : en);

function mapCond(c) {
  if (!c || typeof c !== 'object') return c;
  const out = { ...c };
  if (out.label) out.label = COND_ES[out.label] || out.label;
  if (out.ask) out.ask = COND_ES[out.ask] || out.ask;
  if (out.any) out.any = out.any.map(mapCond);
  if (out.all) out.all = out.all.map(mapCond);
  return out;
}

export function localizeRule(rule, lang) {
  if (!isEs(lang)) return rule;
  const es = RULES_ES[rule.id];
  const out = { ...rule, agency: AGENCY_ES[rule.agency] || rule.agency, applies: mapCond(rule.applies) };
  if (rule.source?.label && SOURCE_LABEL_ES[rule.source.label]) out.source = { ...rule.source, label: SOURCE_LABEL_ES[rule.source.label] };
  if (!es || es.version !== rule.version) return out;
  out.title = es.title || rule.title;
  out.reason = { ...rule.reason, ...es.reason };
  if (es.detail) out.detail = es.detail;
  if (es.fallback) out.fallback = es.fallback;
  if (es.supports) out.supports = es.supports;
  if (es.limits) out.limits = es.limits;
  if (es.vnote && rule.verification) out.verification = { ...rule.verification, note: es.vnote };
  if (es.noLink !== undefined) out.noLink = es.noLink;
  if (es.noLinkCounty) out.noLinkCounty = es.noLinkCounty;
  if (rule.apply && es.apply) out.apply = { ...rule.apply, label: es.apply };
  if (rule.guide && es.guide) {
    const g = rule.guide;
    const eg = es.guide;
    out.guide = {
      ...g,
      meaning: eg.meaning || g.meaning,
      who: sameLen(g.who, eg.who),
      conditions: sameLen(g.conditions, eg.conditions),
      prepare: sameLen(g.prepare, eg.prepare),
      prepareNote: eg.prepareNote ?? g.prepareNote,
      steps: Array.isArray(g.steps) && Array.isArray(eg.steps) && g.steps.length === eg.steps.length ? g.steps.map((s, i) => ({ ...s, text: eg.steps[i] })) : g.steps,
      facts: Array.isArray(g.facts) && Array.isArray(eg.facts) && g.facts.length === eg.facts.length ? g.facts.map((f, i) => ({ ...f, label: eg.facts[i][0], text: eg.facts[i][1] })) : g.facts,
      pendingNote: eg.pendingNote ?? g.pendingNote,
      whyExternal: eg.whyExternal ?? g.whyExternal,
    };
  }
  return out;
}

export function localizeRules(doc, lang) {
  if (!isEs(lang) || !doc) return doc;
  return { ...doc, phases: { ...doc.phases, ...PHASES_ES }, rules: doc.rules.map((r) => localizeRule(r, lang)) };
}

export function localizeFound(link, lang) {
  if (!isEs(lang)) return link;
  const es = FOUND_ES[link.url];
  return es ? { ...link, ...es } : link;
}

export function localizeCountyNote(note, lang) {
  return isEs(lang) ? (COUNTY_NOTE_ES[note] || note) : note;
}

export function localizeTimes(doc, lang) {
  if (!isEs(lang) || !doc) return doc;
  return {
    ...doc,
    record: TIMELINE_ES.record,
    times: (doc.times || []).map((t) => ({ ...t, ...(TIMES_ES[t.ruleId] || {}) })),
    simulation: doc.simulation ? { ...doc.simulation, ...SIMULATION_ES } : doc.simulation,
  };
}

export const estimateNote = (lang) => (isEs(lang) ? TIMELINE_ES.estimateNote : null);
