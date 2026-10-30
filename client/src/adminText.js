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

// Spanish for the built-in questions and answers shown in the "who sees this step" picker.
// Questions an admin writes (fields that start with "extra.") stay exactly as typed.
const FIELD_ES = { structure: 'Cómo está organizado el negocio', cats: 'Tipo de negocio', hiring: 'Contratará en 90 días', subs: 'Usa subcontratistas', salestax: 'Cobra impuesto sobre ventas', income: 'Ingresos brutos de $12,000 o más', tradename: 'Usa un nombre comercial' };
const OPTION_ES = { yes: 'Sí', no: 'No', unsure: 'No estoy seguro', sole: 'Propietario único', llc: 'LLC', corp: 'Corporación', partnership: 'Sociedad o LLP', food: 'Servicio de comida', construction: 'Contratación de construcción', other: 'Otro servicio o venta' };
export function localizeFields(fields, lang) {
  if (lang !== 'es') return fields;
  return fields.map((f) => (f.field.startsWith('extra.') ? { ...f, options: f.options.map((o) => ((o.value === 'yes' && o.label === 'Yes') || (o.value === 'no' && o.label === 'No') || (o.value === 'unsure' && o.label === 'Not sure') ? { ...o, label: OPTION_ES[o.value] } : o)) } : { ...f, text: FIELD_ES[f.field] || f.text, options: f.options.map((o) => ({ ...o, label: OPTION_ES[o.value] || o.label })) }));
}
