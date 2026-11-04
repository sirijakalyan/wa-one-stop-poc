import { describe, it, expect } from 'vitest';
import { pagesEn, pagesEs } from './i18nPages.js';
import { STRUCTURES, CATS } from './questions.js';

// A screen must never show a raw key like "qn.struct.gp.d". Every option description the questionnaire asks for exists in both languages.
describe('questionnaire option text', () => {
  for (const [lang, table] of [['English', pagesEn], ['Spanish', pagesEs]]) {
    it(`${lang} has a description for every business structure that shows one`, () => {
      const missing = STRUCTURES.filter((o) => o.d && !table[`qn.struct.${o.v}.d`]).map((o) => o.v);
      expect(missing).toEqual([]);
    });
    it(`${lang} has a description for every business category`, () => {
      const missing = CATS.filter((o) => !table[`qn.cat.${o.v}.d`]).map((o) => o.v);
      expect(missing).toEqual([]);
    });
  }
});
