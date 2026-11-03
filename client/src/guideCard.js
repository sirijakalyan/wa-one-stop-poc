// Wording and small helpers for the "Your business" card. The server (server/src/intake.js) owns the logic.
import { CAT_LABEL, STRUCT_LABEL, YN_LABEL, blankAnswers, countyLabel } from './questions.js';
import { CARD_TEXT } from './i18n.js';

export const CARD_FIELDS = ['structure', 'activity', 'place', 'hiring', 'subs', 'salestax', 'income', 'tradename'];
export const FIELD_LABELS = {
  structure: 'Business structure',
  activity: 'What you do',
  place: 'City and county',
  hiring: 'Hiring within 90 days',
  subs: 'Subcontractors',
  salestax: 'Collects sales tax',
  income: 'Gross income $12,000 or more',
  tradename: 'Uses a business name',
};

export const blankCard = () => ({ values: blankAnswers(), status: {}, employees: null, language: 'en' });

// A finished questionnaire is a card where every row is confirmed. Used to show the road to opening day for a saved checklist.
export function cardFromAnswers(answers) {
  const status = {};
  for (const f of CARD_FIELDS) status[f] = 'confirmed';
  for (const id of Object.keys(answers?.extra || {})) status[xField(id)] = 'confirmed';
  return { values: { ...blankAnswers(), ...answers, cats: [...(answers?.cats || [])] }, status, employees: null, language: 'en' };
}

// What the chat card should hold after the owner used the form: every question they answered there is confirmed.
// A question the card had already confirmed but left empty (skipped) stays skipped; anything else the form left blank is asked again.
export function cardFromForm(answers, card) {
  const base = card || blankCard();
  const has = {
    structure: Boolean(answers.structure),
    activity: Boolean(answers.desc?.trim() || answers.cats?.length),
    place: Boolean(answers.city?.trim()),
    hiring: Boolean(answers.hiring), subs: Boolean(answers.subs), salestax: Boolean(answers.salestax), income: Boolean(answers.income), tradename: Boolean(answers.tradename),
  };
  const map = { structure: ['structure'], activity: ['desc', 'cats'], place: ['city', 'county'], hiring: ['hiring'], subs: ['subs'], salestax: ['salestax'], income: ['income'], tradename: ['tradename'] };
  const values = { ...base.values, extra: { ...(base.values.extra || {}) } };
  const status = {};
  for (const f of CARD_FIELDS) {
    const skipped = base.status[f] === 'confirmed' && !map[f].some((k) => (Array.isArray(base.values[k]) ? base.values[k].length : base.values[k]));
    if (has[f]) { for (const k of map[f]) values[k] = k === 'cats' ? [...(answers.cats || [])] : answers[k] || ''; status[f] = 'confirmed'; }
    else if (skipped) status[f] = 'confirmed';
    else { for (const k of map[f]) values[k] = k === 'cats' ? [] : ''; }
  }
  for (const [id, v] of Object.entries(answers.extra || {})) if (v) { values.extra[id] = v; status[xField(id)] = 'confirmed'; }
  return { ...base, values, status };
}

// What the form should hold after a chat. Rows the owner has answered (heard or confirmed) are copied over the form's own answers.
export function answersFromCard(card, base) {
  const a = base ? { ...base, cats: [...(base.cats || [])] } : blankAnswers();
  const map = { structure: ['structure'], activity: ['desc', 'cats'], place: ['city', 'county'], hiring: ['hiring'], subs: ['subs'], salestax: ['salestax'], income: ['income'], tradename: ['tradename'] };
  for (const f of CARD_FIELDS) {
    if (card.status[f] !== 'confirmed' && card.status[f] !== 'heard') continue;
    for (const k of map[f]) a[k] = k === 'cats' ? [...card.values.cats] : card.values[k];
  }
  if (card.values.extra) a.extra = { ...card.values.extra }; // answers to questions an admin added
  return a;
}

export function rowText(card, field, lang = 'en') {
  const v = card.values;
  if (lang === 'es') {
    const x = CARD_TEXT.es;
    switch (field) {
      case 'structure': return v.structure ? x.structure[v.structure] || v.structure : '';
      case 'activity': {
        const types = v.cats.map((c) => x.cat[c]).join(', ');
        const desc = v.desc && v.desc.toLowerCase() !== types.toLowerCase() ? v.desc.charAt(0).toUpperCase() + v.desc.slice(1) : '';
        return [desc, types].filter(Boolean).join(' · ');
      }
      case 'place': { const c = String(v.county || '').replace(/\s+county$/i, '').trim(); return [v.city, c && `Condado de ${c}`].filter(Boolean).join(', '); }
      case 'hiring': return v.hiring ? `${x.yn[v.hiring]}${v.hiring === 'yes' && card.employees ? ` (${card.employees} ${card.employees === 1 ? 'persona' : 'personas'})` : ''}` : '';
      default: return v[field] ? x.yn[v[field]] : '';
    }
  }
  switch (field) {
    case 'structure': return v.structure ? STRUCT_LABEL[v.structure] || v.structure : '';
    case 'activity': {
      const types = v.cats.map((c) => CAT_LABEL[c]).join(', ');
      const desc = v.desc && v.desc.toLowerCase() !== types.toLowerCase() ? v.desc.charAt(0).toUpperCase() + v.desc.slice(1) : '';
      return [desc, types].filter(Boolean).join(' · ');
    }
    case 'place': return [v.city, countyLabel(v.county)].filter(Boolean).join(', ');
    case 'hiring': return v.hiring ? `${YN_LABEL[v.hiring]}${v.hiring === 'yes' && card.employees ? ` (${card.employees} ${card.employees === 1 ? 'person' : 'people'})` : ''}` : '';
    default: return v[field] ? YN_LABEL[v[field]] : '';
  }
}

// The rows of the card: the standard questions an admin has not deleted, then one row for each question an admin added.
// Ask for "of 9" or "of 10" and the count grows with them.
export const xField = (id) => `x:${id}`;
export const isExtraField = (f) => String(f).startsWith('x:');
export function fieldsOf(standard = [], extraQs = []) {
  const hidden = new Set(standard.filter((s) => s.hidden).map((s) => s.field));
  return [...CARD_FIELDS.filter((f) => !hidden.has(f)), ...extraQs.map((q) => xField(q.id))];
}
export const isComplete = (card, fields = CARD_FIELDS) => fields.every((f) => card.status[f] === 'confirmed');
export const confirmedCount = (card, fields = CARD_FIELDS) => fields.filter((f) => card.status[f] === 'confirmed').length;

// The answer to an admin-added question, as its label.
export function extraText(card, q) {
  const v = card.values?.extra?.[q.id];
  return q.options.find((o) => o.value === v)?.label || '';
}
