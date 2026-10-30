import { useLang } from './i18n.js';

// Admin screens are bilingual. a('English', 'Español') returns the text for the language chosen in the header.
// The Spanish is a draft for a person to review.
export function useA() {
  const { lang } = useLang();
  const a = (en, es) => (lang === 'es' && es != null ? es : en);
  a.lang = lang;
  a.locale = lang === 'es' ? 'es-US' : 'en-US';
  return a;
}
