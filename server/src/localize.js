// Turns the English rule records into Spanish for display. The English records stay the source of truth: a Spanish entry is used
// only while the rule is still at the version it was written for, and any field it lacks stays in English.
import { SOURCE_LABEL_ES, RULES_ES, PHASES_ES, COND_ES, AGENCY_ES, FOUND_ES, COUNTY_NOTE_ES, TIMES_ES, SIMULATION_ES, TIMELINE_ES } from './ruleText.es.js';

const isEs = (lang) => lang === 'es';

// A translated list replaces the English one only when it has the same number of entries.
const sameLen = (en, es) => (Array.isArray(en) && Array.isArray(es) && en.length === es.length ? es : en);

// qmap: English question text or answer label -> Spanish, for the questions an admin added (when a Spanish version was written).
export function questionMap(questions) {
  const m = new Map([['Yes', 'Sí'], ['No', 'No'], ['Not sure', 'No estoy seguro']]);
  for (const q of questions || []) {
    if (!q.es) continue;
    if (q.es.text) { m.set(q.text, q.es.text); m.set(q.text.toLowerCase(), q.es.text.toLowerCase()); }
    const picks = (q.options || []).filter((o) => o.value !== 'unsure');
    if (Array.isArray(q.es.options) && q.es.options.length === picks.length) picks.forEach((o, i) => m.set(o.label, q.es.options[i]));
  }
  return m;
}

function mapCond(c, qmap) {
  if (!c || typeof c !== 'object') return c;
  const out = { ...c };
  const tr = (t) => (qmap && qmap.get(t)) || t;
  if (out.label) {
    const m = /^you answered "(.+)" to "(.+)"$/.exec(out.label);
    out.label = COND_ES[out.label] || (m ? `usted respondió "${tr(m[1])}" a "${tr(m[2])}"` : out.label);
  }
  if (out.ask) out.ask = COND_ES[out.ask] || tr(out.ask) || out.ask;
  if (out.any) out.any = out.any.map((x) => mapCond(x, qmap));
  if (out.all) out.all = out.all.map((x) => mapCond(x, qmap));
  return out;
}

// Rules an admin adds carry sentences the app wrote. These are their Spanish forms; whatever the admin typed stays as typed.
const CUSTOM_ES = {
  'This step applies to every business.': 'Este paso aplica a todos los negocios.',
  'This step applies because {hits}.': 'Este paso aplica porque {hits}.',
  'You were not sure about: {unsure}. This step may apply to you.': 'No estaba seguro de: {unsure}. Este paso puede aplicarle.',
  'Left out because of your answers.': 'Se omite por sus respuestas.',
  'Added by an admin. A second person has not checked it against the official page yet.': 'Agregada por un administrador. Una segunda persona aún no la ha revisado contra la página oficial.',
  'Open the official page': 'Abrir la página oficial',
  'This step has no apply button. Use the source link under Source details.': 'Este paso no tiene botón de solicitud. Use el enlace de la fuente en Detalles de la fuente.',
};
const customEs = (t) => CUSTOM_ES[t] || t;

export function localizeRule(rule, lang, qmap) {
  if (!isEs(lang)) return rule;
  if (rule.custom) {
    const es = rule.es || {};
    return {
      ...rule,
      title: es.title || rule.title,
      agency: es.agency || rule.agency,
      detail: es.detail || rule.detail,
      source: rule.source ? { ...rule.source, label: es.sourceLabel || rule.source.label } : rule.source,
      reason: rule.reason ? Object.fromEntries(Object.entries(rule.reason).map(([k, v]) => [k, customEs(v)])) : rule.reason,
      verification: rule.verification ? { ...rule.verification, note: customEs(rule.verification.note) } : rule.verification,
      apply: rule.apply ? { ...rule.apply, label: es.applyLabel || customEs(rule.apply.label) } : rule.apply,
      noLink: customEs(rule.noLink),
      applies: mapCond(rule.applies, qmap),
    };
  }
  const es = RULES_ES[rule.id];
  const out = { ...rule, agency: AGENCY_ES[rule.agency] || rule.agency, applies: mapCond(rule.applies, qmap) };
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
  return { ...doc, phases: { ...doc.phases, ...PHASES_ES }, rules: doc.rules.map((r) => localizeRule(r, lang, questionMap(doc.questions))) };
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
