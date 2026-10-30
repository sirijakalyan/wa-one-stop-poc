// Questionnaire content. The server's engine owns the rules; this file only holds wording.
export const STRUCTURES = [
  { v: 'sole', t: 'Sole proprietor', d: 'You own the business yourself and have not formed a separate entity.' },
  { v: 'llc', t: 'Limited liability company (LLC)', d: '' },
  { v: 'corp', t: 'Corporation', d: '' },
  { v: 'partnership', t: 'Partnership or LLP', d: '' },
  { v: 'unsure', t: 'Not sure yet', d: 'The Secretary of State step will show as "may apply".' },
];
export const STRUCT_LABEL = { sole: 'Sole proprietor', llc: 'LLC', corp: 'Corporation', partnership: 'Partnership or LLP', unsure: 'Structure not sure yet' };

export const CATS = [
  { v: 'food', t: 'Food service', d: 'Restaurant, cafe, catering, food truck' },
  { v: 'construction', t: 'Construction contracting', d: 'Building, remodeling, roofing, trade work' },
  { v: 'other', t: 'Other service or retail', d: 'Anything else' },
];
export const CAT_LABEL = { food: 'Food service', construction: 'Construction contracting', other: 'Other service or retail' };

export const YN = [
  { v: 'yes', t: 'Yes' },
  { v: 'no', t: 'No' },
  { v: 'unsure', t: 'Not sure' },
];
export const YN_LABEL = { yes: 'Yes', no: 'No', unsure: 'Not sure' };
export const YN_FIELDS = ['hiring', 'subs', 'salestax', 'income', 'tradename'];

export const QUESTIONS = {
  structure: { title: 'How will your business be set up?', hint: 'This decides whether the Secretary of State comes first.' },
  desc: { title: 'What will your business do?', hint: 'Optional. A sentence or two in your own words.' },
  cats: { title: 'What kind of business is this?', hint: 'You choose. Pick every type that fits. Only "Construction contracting" adds the Labor & Industries contractor registration step.' },
  city: { title: 'Which city and county will you work in?', hint: 'Optional. We use this only to name your county in the county health step. It does not confirm any local rule.' },
  hiring: { title: 'Will you hire employees within the next 90 days?', hint: 'Hiring is one of the triggers for a state business license.' },
  subs: { title: 'Will you use subcontractors or independent contractors?', hint: 'This is about people you pay to do work for you. It adds a step to review independent-contractor rules. It does not make your business a construction contractor. That depends on your business type.' },
  salestax: { title: 'Will you sell products or services that require collecting sales tax?', hint: 'Not sure is a fine answer. The checklist will say "may apply".' },
  income: { title: 'Do you expect gross income of $12,000 a year or more?', hint: 'This is one of the registration triggers listed by the Department of Revenue.' },
  tradename: { title: 'Will you do business under a name other than your full legal name?', hint: '' },
  review: { title: 'Review your answers', hint: 'Change anything, then build the checklist.' },
};

// extraIds: the ids of questions an admin added. They come after the standard ones, as "x:<id>" steps.
// hidden: standard questions an admin deleted (card names: structure, activity, place, hiring, ...).
const STEP_FIELD = { desc: 'activity', cats: 'activity', city: 'place' };
export function stepList(answers, extraIds = [], hidden = []) {
  // The business type is always asked, even when the description is blank, because it controls
  // type-specific steps such as the Labor & Industries contractor registration.
  const steps = ['structure', 'desc', 'cats', 'city', 'hiring', 'subs', 'salestax', 'income', 'tradename'].filter((id) => !hidden.includes(STEP_FIELD[id] || id));
  return [...steps, ...extraIds.map((id) => `x:${id}`), 'review'];
}

export const blankAnswers = () => ({ structure: '', desc: '', cats: [], city: '', county: '', hiring: '', subs: '', salestax: '', income: '', tradename: '' });

// Same wording as the server: "King", "king county" and "King County" all show as "King County".
export function countyLabel(county) {
  const name = String(county || '').trim().replace(/\s+county$/i, '').trim();
  return name ? `${name} County` : '';
}

// Convenience list for the county box. It is a typing aid, not an official source, and any county can be typed.
export const WA_COUNTIES = ['Adams', 'Asotin', 'Benton', 'Chelan', 'Clallam', 'Clark', 'Columbia', 'Cowlitz', 'Douglas', 'Ferry', 'Franklin', 'Garfield', 'Grant', 'Grays Harbor', 'Island', 'Jefferson', 'King', 'Kitsap', 'Kittitas', 'Klickitat', 'Lewis', 'Lincoln', 'Mason', 'Okanogan', 'Pacific', 'Pend Oreille', 'Pierce', 'San Juan', 'Skagit', 'Skamania', 'Snohomish', 'Spokane', 'Stevens', 'Thurston', 'Wahkiakum', 'Walla Walla', 'Whatcom', 'Whitman', 'Yakima'];
