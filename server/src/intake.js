// The talking guide. Written rules decide what applies; this file only listens, takes notes and asks follow-ups.
//
// The guide may:     turn what the owner says into a DRAFT "Your business" card, ask a follow-up, explain why a step is on the plan.
// The guide may not: put anything on the plan before the owner confirms it, or decide what applies (engine.js does that).
//
// No Node imports, so this file also runs in the in-page preview. Nothing here uses AI or randomness:
// facts are picked out of the owner's words with plain patterns, so the demo works with no model running.

import { evaluate, normalizeAnswers, CATEGORY_LABELS, STRUCTURE_LABELS, countyLabel, blankAnswers } from './engine.js';

// One row of the card per field. "heard" = picked up from the owner's words. "confirmed" = the owner said yes.
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

export function blankCard() {
  return { values: blankAnswers(), status: {}, employees: null, language: 'en' };
}

const YN_WORD = { yes: 'Yes', no: 'No', unsure: 'Not sure' };
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, an: 1 };
const UNSURE_RX = /\b(not sure|unsure|don'?t know|do not know|no idea|maybe|not certain)\b/i;

// ---- Reading the owner's words -------------------------------------------------------------------------------------

function loadPlaces(places) {
  const list = (places || []).map(([name, county]) => ({ name, county, key: name.toLowerCase() }));
  // Longest names first so "Bainbridge Island" wins over "Bainbridge".
  return list.sort((a, b) => b.name.length - a.name.length);
}

function findPlace(text, places, { anywhere }) {
  const t = String(text);
  for (const p of places) {
    const name = p.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // In running speech a city needs a word like "in" before it, so common words are not mistaken for a city.
    const rx = anywhere
      ? new RegExp(`(^|[^a-z])${name}(?=$|[^a-z])`, 'i')
      : new RegExp(`\\b(?:in|at|near|around|outside|from|downtown)\\s+${name}(?=$|[^a-z])`, 'i');
    if (rx.test(t)) return p;
  }
  return null;
}

// An explicit "<name> County" is matched against the real county names, so words before it are never swallowed.
function findCounty(text, places) {
  const names = [...new Set((places || []).map(([, c]) => c))].sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (new RegExp(`(^|[^a-z])${name.toLowerCase()}\\s+county(?=$|[^a-z])`, 'i').test(text)) return name;
  }
  return '';
}

function numberOf(s) {
  const n = String(s || '').toLowerCase();
  if (/^\d+$/.test(n)) return Number(n);
  return NUMBER_WORDS[n] || null;
}

function moneyFrom(text) {
  const near = /(?:income|revenue|earn(?:ing)?s?|make|making|gross|sales|bring in|profit)[^.]{0,50}?\$?\s?(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|million)?/i.exec(text)
    || /\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|million)?[^.]{0,30}?(?:a year|per year|annually|yearly|in sales|in revenue)/i.exec(text);
  if (!near) return null;
  let n = Number(near[1].replace(/,/g, ''));
  const unit = (near[2] || '').toLowerCase();
  if (unit === 'k' || unit === 'thousand') n *= 1000;
  if (unit === 'million') n *= 1000000;
  return Number.isFinite(n) ? n : null;
}

const ACTIVITY_PHRASES = [
  'food truck', 'restaurant', 'coffee shop', 'cafe', 'bakery', 'catering', 'bar', 'brewery', 'remodeling', 'roofing', 'framing',
  'plumbing', 'electrical', 'landscaping', 'construction', 'cleaning', 'salon', 'barbershop', 'consulting', 'photography', 'retail shop',
  'online store', 'daycare', 'gym', 'bookkeeping', 'plumber', 'electrician', 'roofer', 'carpenter', 'handyman', 'tutor', 'photographer', 'hair salon', 'nail salon',
];

// "wanted to start a food service" is a story, not a description. Keep just the kind of business.
export function cleanDesc(text) {
  const t = String(text || '').trim().replace(/[.!?]+$/, '');
  const c = t.replace(/^(?:(?:i|we)(?:'d| would| want| wanted| am| are| will| plan| planned)?\s*)?(?:(?:really |just )?(?:want|wanted|would like|like|plan|planning|going|trying|need|hope|hoping)\s+(?:to\s+)?)?(?:start|open|run|launch|begin|operate|set up|do|have|starting|opening|running)\s+(?:a|an|my|the|some)?\s*/i, '').trim();
  return (c || t).slice(0, 120);
}

const CONFIRM_YES = new Set(['yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'correct', 'right', 'exactly', 'absolutely', 'definitely', 'good', 'perfect', 'fine', 'huh']);
const CONFIRM_FILLER = new Set(['that', "that's", 'thats', 'is', 'it', "it's", 'its', 'looks', 'sounds', 'great', 'please', 'thanks', 'thank', 'you', 'got', 'uh', 'um', 'mm', 'hmm', 'go', 'ahead', 'all', 'very', 'so', 'and', 'the', 'this', 'are', 'was', 'be']);
const CONFIRM_NO = new Set(['no', 'nope', 'nah', 'wrong', 'incorrect', 'not', "isn't", 'isnt', "that's not", 'change', 'fix', 'mistake', 'wait']);
// While a read-back is waiting ("I heard: LLC. Is that right?"), a spoken "yes that is right" or "no, that's wrong" counts like tapping the button.
export function spokenConfirmation(rawCard, message, asking) {
  if (asking) return null;
  const card = cleanCard(rawCard);
  if (!CARD_FIELDS.some((f) => card.status[f] === 'heard')) return null;
  const words = String(message || '').toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 8) return null;
  if (words.some((w) => CONFIRM_NO.has(w))) return words.every((w) => CONFIRM_NO.has(w) || CONFIRM_FILLER.has(w) || CONFIRM_YES.has(w)) ? 'change' : null;
  if (words.every((w) => CONFIRM_YES.has(w) || CONFIRM_FILLER.has(w)) && words.some((w) => CONFIRM_YES.has(w))) return 'confirm';
  return null;
}

function activityPhrase(text) {
  const t = String(text).toLowerCase();
  const known = ACTIVITY_PHRASES.find((p) => new RegExp(`\\b${p}\\b`).test(t));
  if (known) return known;
  const m = /(?:open|start|run|launch|operate|have|do)\s+(?:a|an|my|some)?\s*([a-z][a-z -]{2,40}?)(?=\s+(?:in|at|near|and|with|that|which|called|for)\b|[,.]|$)/i.exec(String(text));
  return m ? m[1].trim() : '';
}

function categoriesFrom(text) {
  // "subcontractors" and "independent contractors" are about who the owner pays. They never mean construction contracting.
  const t = String(text).toLowerCase().replace(/\b(sub-?contractors?|independent contractors?|contract workers?)\b/g, ' ');
  const out = [];
  if (/restaurant|cafe|coffee|food|catering|bakery|kitchen|\bbar\b|truck|diner|brewery/.test(t)) out.push('food');
  if (/construct|contractor|remodel|roof|plumb|electric|carpent|framing|concrete|handyman/.test(t)) out.push('construction');
  if (!out.length && /shop|store|retail|salon|barber|clean|consult|design|photograph|tutor|daycare|gym|bookkeep|sell|service/.test(t)) out.push('other');
  return out;
}

// Pull every fact we can out of one message. Returns only what was actually said.
export function extractFacts(text, places) {
  const raw = String(text || '').trim();
  const t = raw.toLowerCase();
  const found = {};
  const list = loadPlaces(places);

  if (/\b(llc|l\.l\.c\.|limited liability)\b/i.test(t)) found.structure = 'llc';
  else if (/\b(corporation|incorporated|corp|inc)\b/i.test(t)) found.structure = 'corp';
  else if (/\b(partnership|llp|partners?)\b/i.test(t)) found.structure = 'partnership';
  else if (/\b(sole proprietor(?:ship)?|sole owner|self-employed|self employed)\b/i.test(t)) found.structure = 'sole';

  const cats = categoriesFrom(t);
  if (cats.length) {
    found.cats = cats;
    found.desc = (activityPhrase(raw) || cleanDesc(raw)).slice(0, 120);
  }

  const explicitCounty = findCounty(raw, places);
  const place = findPlace(raw, list, { anywhere: false });
  if (place) {
    found.city = place.name;
    found.county = explicitCounty || place.county;
  } else if (explicitCounty) {
    found.county = explicitCounty;
  }

  const countMatch = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:more\s+)?(?:people|workers|employees|staff|helpers|cooks|servers|hires?|team members)\b/i.exec(raw);
  if (/\b(no employees|no staff|no workers|without employees|(?:don'?t|do not) have (?:any )?(?:employees|staff|workers)|not hiring|won'?t hire|don'?t (?:plan to )?hire|do not (?:plan to )?hire|no hiring|just me|by myself|on my own|solo|myself only)\b/i.test(t)) {
    found.hiring = 'no';
  } else if (/\b(hire|hiring|employees?|staff|workers?|team members)\b/i.test(t) || countMatch) {
    found.hiring = 'yes';
    const n = countMatch ? numberOf(countMatch[1]) : null;
    if (n) found.employees = n;
  }

  if (/\b(no subcontractors|without subcontractors|no independent contractors|won'?t use subcontractors|don'?t use subcontractors)\b/i.test(t)) found.subs = 'no';
  else if (/\b(subcontract\w*|independent contractors?|freelanc\w*|contract workers?|1099)\b/i.test(t)) found.subs = 'yes';

  if (/\b(no sales tax|don'?t (?:collect|charge)|do not (?:collect|charge)|won'?t (?:collect|charge)|services? only|not selling products)\b/i.test(t)) found.salestax = 'no';
  else if (/\bsales tax\b|\bretail\b|\bsell(?:ing)?\s+(?:products?|goods|merchandise|items|food|meals|drinks|things)\b/i.test(t)) found.salestax = 'yes';

  const money = moneyFrom(raw);
  if (money != null) {
    if (/\b(less than|under|below|fewer than)\b/i.test(raw)) found.income = money <= 12000 ? 'no' : 'yes';
    else found.income = money >= 12000 ? 'yes' : 'no';
  }

  if (/\b(business name|trade name|dba|doing business as|under the name|call(?:ed|ing)? (?:it|my business|the business)|my brand|named)\b/i.test(t)) found.tradename = 'yes';
  if (/\b(under my (?:own |legal |full )?name|using my (?:own |legal |full )?name|no business name|my own name)\b/i.test(t)) found.tradename = 'no';

  return found;
}

// A short answer to the one question we just asked. A tap or a typed answer here counts as confirmed.
export function parseDirect(field, text, places) {
  const raw = String(text || '').trim();
  const t = raw.toLowerCase();
  if (!raw) return null;
  if (field === 'structure') {
    if (UNSURE_RX.test(t)) return { structure: 'unsure' };
    const f = extractFacts(raw, places);
    if (f.structure) return { structure: f.structure };
    if (/^(llc|limited liability company)/.test(t)) return { structure: 'llc' };
    if (/^sole|^myself|^just me|^self/.test(t)) return { structure: 'sole' };
    return null;
  }
  if (field === 'activity') {
    const cats = categoriesFrom(t);
    if (/food/.test(t) && !/construction/.test(t)) return { cats: ['food'], desc: cleanDesc(raw) };
    if (/construction/.test(t)) return { cats: ['construction'], desc: cleanDesc(raw) };
    if (/other|retail|service/.test(t) && !cats.length) return { cats: ['other'], desc: cleanDesc(raw) };
    return cats.length ? { cats, desc: cleanDesc(raw) } : null;
  }
  if (field === 'place') {
    if (/^(skip|later|no|none|not now|not sure|prefer not)/.test(t) || UNSURE_RX.test(t)) return { city: '', county: '', skipped: true };
    const list = loadPlaces(places);
    const county = findCounty(raw, places);
    const p = findPlace(raw, list, { anywhere: true });
    if (p) return { city: p.name, county: county || p.county };
    if (county) return { city: '', county };
    return null;
  }
  if (['hiring', 'subs', 'salestax', 'income', 'tradename'].includes(field)) {
    if (UNSURE_RX.test(t)) return { [field]: 'unsure' };
    if (/^(yes|yeah|yep|yup|sure|correct|right|definitely|i will|we will|i do|we do|probably)\b/.test(t)) return { [field]: 'yes' };
    if (/^(no|nope|nah|none|never|not)\b/.test(t)) return { [field]: 'no' };
    const f = extractFacts(raw, places);
    if (f[field]) return { [field]: f[field] };
    return null;
  }
  return null;
}

// ---- The card ------------------------------------------------------------------------------------------------------

const FIELD_KEYS = {
  structure: ['structure'],
  activity: ['desc', 'cats'],
  place: ['city', 'county'],
  hiring: ['hiring'],
  subs: ['subs'],
  salestax: ['salestax'],
  income: ['income'],
  tradename: ['tradename'],
};

function cleanCard(card) {
  const values = normalizeAnswers(card?.values);
  const status = {};
  for (const f of CARD_FIELDS) {
    if (card?.status?.[f] === 'heard' || card?.status?.[f] === 'confirmed') status[f] = card.status[f];
  }
  const employees = Number.isInteger(card?.employees) && card.employees > 0 && card.employees < 1000 ? card.employees : null;
  return { values, status, employees, language: 'en' };
}

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Put heard facts on the card. A heard fact never overrides a confirmed one with the same value; a different value is re-asked.
function mergeHeard(card, found) {
  const next = { ...card, values: { ...card.values }, status: { ...card.status } };
  const changed = [];
  const put = (field, patch) => {
    const keys = FIELD_KEYS[field];
    const differs = keys.some((k) => !sameValue(next.values[k], patch[k] ?? next.values[k]));
    const had = Boolean(next.status[field]);
    if (had && !differs) return;
    for (const k of keys) if (k in patch) next.values[k] = patch[k];
    next.status[field] = 'heard';
    changed.push(field);
  };
  if (found.structure) put('structure', { structure: found.structure });
  if (found.cats) put('activity', { cats: found.cats, desc: found.desc || next.values.desc });
  if (found.city || found.county) put('place', { city: found.city ?? next.values.city, county: found.county ?? next.values.county });
  for (const f of ['hiring', 'subs', 'salestax', 'income', 'tradename']) if (found[f]) put(f, { [f]: found[f] });
  if (found.employees) next.employees = found.employees;
  return { card: next, changed };
}

function setConfirmed(card, field, patch) {
  const next = { ...card, values: { ...card.values }, status: { ...card.status } };
  for (const k of FIELD_KEYS[field]) if (k in patch) next.values[k] = patch[k];
  next.status[field] = 'confirmed';
  if (field === 'hiring' && patch.hiring !== 'yes') next.employees = null;
  return next;
}

export function describeField(card, field) {
  const v = card.values;
  switch (field) {
    case 'structure': return v.structure ? STRUCTURE_LABELS[v.structure] : '';
    case 'activity': {
      const types = v.cats.map((c) => CATEGORY_LABELS[c]).join(', ');
      const desc = v.desc && v.desc.toLowerCase() !== types.toLowerCase() ? v.desc.charAt(0).toUpperCase() + v.desc.slice(1) : '';
      return [desc, types].filter(Boolean).join(' · ');
    }
    case 'place': return [v.city, countyLabel(v.county) && `${countyLabel(v.county)}`].filter(Boolean).join(', ');
    case 'hiring': return v.hiring ? `${YN_WORD[v.hiring]}${v.hiring === 'yes' && card.employees ? ` (${card.employees} ${card.employees === 1 ? 'person' : 'people'})` : ''}` : '';
    default: return v[field] ? YN_WORD[v[field]] : '';
  }
}

export const isComplete = (card) => CARD_FIELDS.every((f) => card.status[f] === 'confirmed');

// ---- What the guide says -------------------------------------------------------------------------------------------

const ASKS = {
  structure: {
    question: 'How will your business be set up? If you are not sure, that is fine.',
    chips: [['sole', 'Sole proprietor'], ['llc', 'LLC'], ['corp', 'Corporation'], ['partnership', 'Partnership or LLP'], ['unsure', 'Not sure']],
  },
  activity: {
    question: 'What kind of business is it?',
    chips: [['food', 'Food service'], ['construction', 'Construction contracting'], ['other', 'Other service or retail']],
  },
  place: {
    question: 'Which city will you work in? I will fill in the county. You can skip this.',
    chips: [['skip', 'Skip for now']],
  },
  hiring: { question: 'Will you hire anyone within the next 90 days?', chips: 'yn' },
  subs: { question: 'Will you pay subcontractors or independent contractors to do work for you?', chips: 'yn' },
  salestax: { question: 'Will you sell products or services that need sales tax collected?', chips: 'yn' },
  income: { question: 'Do you expect gross income of $12,000 a year or more?', chips: 'yn' },
  tradename: { question: 'Will you do business under a name other than your full legal name?', chips: 'yn' },
};
const YN_CHIPS = [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']];

export function nextAsk(card) {
  const field = CARD_FIELDS.find((f) => !card.status[f]);
  if (!field) return null;
  const a = ASKS[field];
  return { field, question: a.question, chips: (a.chips === 'yn' ? YN_CHIPS : a.chips).map(([value, label]) => ({ value, label })) };
}

function readback(card, fields) {
  const parts = fields.map((f) => {
    const text = describeField(card, f);
    if (f === 'hiring') return card.values.hiring === 'yes' ? `hiring${card.employees ? ` ${card.employees} ${card.employees === 1 ? 'person' : 'people'}` : ''} within 90 days` : card.values.hiring === 'no' ? 'no hiring within 90 days' : 'not sure about hiring';
    if (f === 'subs') return card.values.subs === 'yes' ? 'using subcontractors' : card.values.subs === 'no' ? 'no subcontractors' : 'not sure about subcontractors';
    if (f === 'salestax') return card.values.salestax === 'yes' ? 'collecting sales tax' : card.values.salestax === 'no' ? 'not collecting sales tax' : 'not sure about sales tax';
    if (f === 'income') return card.values.income === 'yes' ? 'income of $12,000 or more' : card.values.income === 'no' ? 'income under $12,000' : 'not sure about income';
    if (f === 'tradename') return card.values.tradename === 'yes' ? 'using a business name' : card.values.tradename === 'no' ? 'using your own name' : 'not sure about a business name';
    return text;
  }).filter(Boolean);
  return `I heard: ${parts.join('; ')}. Is that right?`;
}

const CONFIRM_CHIPS = [{ value: 'confirm', label: "Yes, that's right" }, { value: 'change', label: 'Change something' }];

// One turn of the conversation. Pure: the card goes in, a new card and the guide's reply come out.
//   input: { message, action, field, value, asking }
//   action: 'confirm' (read-back accepted), 'change' (read-back rejected), 'set' (tap a chip or edit a row), 'skip'
export function intakeTurn({ card: rawCard, message, action, field, value, asking }, { places } = {}) {
  let card = cleanCard(rawCard);
  const said = String(message || '').trim().slice(0, 500);
  let ack = '';

  if (action === 'confirm') {
    for (const f of CARD_FIELDS) if (card.status[f] === 'heard') card.status[f] = 'confirmed';
    ack = 'Thank you. That is on your card.';
  } else if (action === 'change') {
    return finish(card, 'No problem. Tap any row on your card to change it, or tell me what to fix.', { ask: nextAskUnlessHeard(card), chips: [] });
  } else if (action === 'set' && CARD_FIELDS.includes(field)) {
    card = applySet(card, field, value, places);
    ack = 'Got it.';
  } else if (said) {
    const direct = asking && CARD_FIELDS.includes(asking) ? parseDirect(asking, said, places) : null;
    if (direct) {
      card = setConfirmed(card, asking, direct);
      ack = 'Got it.';
    }
    // Anything else in the message is heard, not confirmed. The asked field is skipped so a one-word answer is not re-read.
    const found = extractFacts(said, places);
    if (direct) for (const k of FIELD_KEYS[asking]) delete found[k];
    const merged = mergeHeard(card, found);
    card = merged.card;
    if (!direct && !merged.changed.length) {
      return finish(card, asking === 'place' ? 'I did not catch a Washington city in that. Say or type the city again, or tap Skip for now.' : asking ? "I did not catch that. Please tap one of the answers below or type it again." : 'I did not pick out a business detail from that. Tell me what you want to start, or answer the question below.', { ask: nextAskUnlessHeard(card), note: 'no-facts' });
    }
  } else {
    return finish(card, nextAsk(card)?.question || 'Your card is complete.', { ask: nextAsk(card) });
  }
  return finishTurn(card, ack);
}

function applySet(card, field, value, places) {
  if (field === 'place') {
    const v = typeof value === 'object' && value ? value : parseDirect('place', String(value ?? ''), places) || { city: '', county: '' };
    return setConfirmed(card, 'place', { city: String(v.city || '').slice(0, 80), county: String(v.county || '').slice(0, 80) });
  }
  if (field === 'activity') {
    const v = typeof value === 'object' && value ? value : { cats: [String(value)], desc: card.values.desc };
    const cats = (v.cats || []).filter((c) => c in CATEGORY_LABELS);
    return setConfirmed(card, 'activity', { cats, desc: String(v.desc ?? card.values.desc ?? '').slice(0, 120) });
  }
  if (field === 'structure') return setConfirmed(card, 'structure', { structure: value in STRUCTURE_LABELS ? value : '' });
  const ok = ['yes', 'no', 'unsure'].includes(value) ? value : '';
  const next = setConfirmed(card, field, { [field]: ok });
  if (!ok) delete next.status[field];
  return next;
}

function nextAskUnlessHeard(card) {
  return CARD_FIELDS.some((f) => card.status[f] === 'heard') ? null : nextAsk(card);
}

function finishTurn(card, ack) {
  const heard = CARD_FIELDS.filter((f) => card.status[f] === 'heard');
  if (heard.length) {
    return { card, reply: [ack, readback(card, heard)].filter(Boolean).join(' '), ask: null, chips: CONFIRM_CHIPS, awaiting: 'confirm', complete: false };
  }
  return finish(card, '', { ack, ask: nextAsk(card) });
}

function finish(card, reply, { ask = null, ack = '', chips = null, note = '' } = {}) {
  const complete = isComplete(card);
  if (complete) {
    return {
      card,
      reply: [ack, 'That is everything I need. Your plan and your road to opening day are ready on the right. Every step shows the answer behind it.'].filter(Boolean).join(' '),
      ask: null, chips: [{ value: 'save', label: 'Save my plan' }], awaiting: null, complete: true,
    };
  }
  const text = reply || [ack, ask?.question].filter(Boolean).join(' ');
  return { card, reply: text, ask: ask || null, chips: chips ?? ask?.chips ?? [], awaiting: ask ? 'answer' : null, complete: false, ...(note ? { note } : {}) };
}

// ---- Plan and timeline ---------------------------------------------------------------------------------------------

// The rules engine reads only confirmed fields. Everything else is blank, which the engine treats as unknown.
export function confirmedAnswers(card) {
  const c = cleanCard(card);
  const a = blankAnswers();
  for (const f of CARD_FIELDS) {
    if (c.status[f] !== 'confirmed') continue;
    for (const k of FIELD_KEYS[f]) a[k] = c.values[k];
  }
  return a;
}

export function planFromCard(card, rules) {
  const c = cleanCard(card);
  const confirmedCount = CARD_FIELDS.filter((f) => c.status[f] === 'confirmed').length;
  const complete = isComplete(c);
  const answers = confirmedAnswers(c);
  if (!confirmedCount) return { complete: false, answers, items: [], skipped: [] };
  const { items, skipped } = evaluate(rules, answers);
  // While the card is still filling in, show only steps that a confirmed answer already triggers.
  const shown = items.filter((i) => complete || i.status === 'applies');
  return {
    complete,
    answers,
    items: shown.map((i) => ({
      id: i.rule.id, title: i.rule.title, agency: i.rule.agency, phase: i.rule.phase, status: i.status,
      trigger: i.reason, after: i.rule.after || null,
      verification: i.rule.verification?.status || 'pending',
      lastVerified: i.rule.lastVerified || null,
      source: i.rule.source || null,
    })),
    skipped: complete ? skipped : [],
  };
}

// ---- Road to opening day -------------------------------------------------------------------------------------------

const DAY = 86400000;
function addTime(date, t) {
  const d = new Date(date.getTime());
  if (t.kind === 'business') {
    let left = t.days;
    while (left > 0) {
      d.setTime(d.getTime() + DAY);
      const w = d.getUTCDay();
      if (w !== 0 && w !== 6) left -= 1;
    }
    return d;
  }
  d.setTime(d.getTime() + t.days * DAY);
  return d;
}
const isoDay = (d) => d.toISOString().slice(0, 10);

// Orders steps by phase and by "comes after", attaches only the processing times recorded in doc 11, and adds up an earliest
// date along the steps that depend on each other. A step with no recorded time says so and adds nothing to the date.
export function buildTimeline(plan, phases, timesDoc, now = new Date(), { simulate = false } = {}) {
  const startDay = new Date(`${isoDay(now)}T00:00:00Z`);
  const byRule = Object.fromEntries((timesDoc?.times || []).map((t) => [t.ruleId, t]));
  if (simulate && timesDoc?.simulation) byRule[timesDoc.simulation.ruleId] = { ...byRule[timesDoc.simulation.ruleId], ...timesDoc.simulation };
  const planIds = new Set(plan.items.map((i) => i.id));
  const end = {};
  const endOf = (id, seen = new Set()) => {
    if (id in end) return end[id];
    if (seen.has(id)) return startDay;
    seen.add(id);
    const item = plan.items.find((i) => i.id === id);
    const prior = item?.after && planIds.has(item.after) ? endOf(item.after, seen) : startDay;
    const t = byRule[id];
    end[id] = t ? addTime(prior, t.min) : prior;
    return end[id];
  };
  const steps = plan.items.map((i) => {
    const t = byRule[i.id] || null;
    return {
      id: i.id, title: i.title, agency: i.agency, phase: i.phase, status: i.status, verification: i.verification, after: i.after,
      time: t ? { label: t.label, text: t.text, note: t.note || '', sourceLabel: t.sourceLabel || '', retrievedOn: timesDoc.retrievedOn } : null,
    };
  });
  const timed = steps.filter((s) => s.time);
  const phaseRows = Object.entries(phases || {})
    .map(([p, name]) => ({ phase: Number(p), name, steps: steps.filter((s) => String(s.phase) === p) }))
    .filter((p) => p.steps.length);
  let estimate = null;
  if (plan.complete && timed.length) {
    const dates = plan.items.map((i) => endOf(i.id));
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
    estimate = {
      date: isoDay(latest),
      basedOn: timed.map((s) => ({ id: s.id, title: s.title, text: s.time.text })),
      noPublishedTime: steps.filter((s) => !s.time).map((s) => s.title),
      note: 'Based on agency published estimates, not a guarantee. It counts only the steps that have a recorded time and does not count holidays, so your real date may be later.',
    };
  }
  return {
    phases: phaseRows,
    estimate,
    pending: !plan.complete,
    retrievedOn: timesDoc?.retrievedOn || null,
    record: timesDoc?.record || '',
    simulated: Boolean(simulate),
  };
}
