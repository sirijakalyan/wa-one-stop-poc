// The three business scenarios from the POC plan. Answers only, never rules. "story" is the sentence the guide starts from.
export const SAMPLES = [
  {
    id: 'home',
    title: 'Home-based service business',
    story: 'I clean and organize homes. I work by myself from my house and I use my own name.',
    blurb: 'A sole proprietor with no employees. Shows that the Secretary of State step is left out.',
    answers: { structure: 'sole', desc: 'Home cleaning and organizing services run from my house', cats: ['other'], city: '', county: '', hiring: 'no', subs: 'no', salestax: 'no', income: 'no', tradename: 'yes' },
  },
  {
    id: 'restaurant',
    title: 'Restaurant',
    story: 'We are an LLC and want to open a neighborhood restaurant in Bellevue. We will hire a team of eight and we will sell food and drinks.',
    blurb: 'An LLC with employees. Shows ordering, hiring steps and a county health reminder.',
    answers: { structure: 'llc', desc: 'Neighborhood restaurant serving lunch and dinner', cats: ['food'], city: '', county: '', hiring: 'yes', subs: 'no', salestax: 'yes', income: 'yes', tradename: 'yes' },
  },
  {
    id: 'contractor',
    title: 'Construction contractor',
    story: 'I am a sole proprietor doing remodeling and framing. I will hire two people and also use subcontractors.',
    blurb: 'A sole proprietor with employees and subcontractors. Shows a credential the business license does not cover.',
    answers: { structure: 'sole', desc: 'Residential remodeling and framing', cats: ['construction'], city: '', county: '', hiring: 'yes', subs: 'yes', salestax: 'unsure', income: 'yes', tradename: 'yes' },
  },
];
