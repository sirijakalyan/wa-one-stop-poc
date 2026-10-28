// Wording and small helpers for the "Your business" card. The server (server/src/intake.js) owns the logic.
import { CAT_LABEL, STRUCT_LABEL, YN_LABEL, blankAnswers, countyLabel } from './questions.js';

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
  return { values: { ...blankAnswers(), ...answers, cats: [...(answers?.cats || [])] }, status, employees: null, language: 'en' };
}

// What the form should hold after a chat. Only confirmed rows are copied, so nothing unconfirmed leaks across.
export function answersFromCard(card) {
  const a = blankAnswers();
  const map = { structure: ['structure'], activity: ['desc', 'cats'], place: ['city', 'county'], hiring: ['hiring'], subs: ['subs'], salestax: ['salestax'], income: ['income'], tradename: ['tradename'] };
  for (const f of CARD_FIELDS) {
    if (card.status[f] !== 'confirmed') continue;
    for (const k of map[f]) a[k] = k === 'cats' ? [...card.values.cats] : card.values[k];
  }
  return a;
}

export function rowText(card, field) {
  const v = card.values;
  switch (field) {
    case 'structure': return v.structure ? STRUCT_LABEL[v.structure] : '';
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

export const isComplete = (card) => CARD_FIELDS.every((f) => card.status[f] === 'confirmed');
export const confirmedCount = (card) => CARD_FIELDS.filter((f) => card.status[f] === 'confirmed').length;
