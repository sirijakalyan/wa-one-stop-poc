import { describe, it, expect } from 'vitest';
import { stepScript } from './StepAudio.jsx';
import { pagesEn } from '../i18nPages.js';

const t = Object.assign((k, ...a) => { const v = pagesEn[k]; return typeof v === 'function' ? v(...a) : v; }, { lang: 'en' });
const item = { title: 'Apply for your license', reason: 'You sell something that needs sales tax.', apply: { url: 'https://example.gov', label: 'Apply now' }, verification: { status: 'pending' } };

describe('stepScript', () => {
  it('reads the title, reason, button name, pending note and the mark-as-done instruction', () => {
    const s = stepScript(item, 2, 5, t);
    expect(s).toMatch(/Step 2 of 5/);
    expect(s).toMatch(/Apply for your license/);
    expect(s).toMatch(/"Apply now"/);
    expect(s).toMatch(/pending verification/);
    expect(s).toMatch(/Mark as done/);
  });
  it('says there is no button when the step has no link', () => {
    expect(stepScript({ ...item, apply: null, verification: { status: 'checked' } }, 1, 1, t)).toMatch(/no button/);
  });
});
