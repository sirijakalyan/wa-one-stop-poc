import { useA } from '../adminText.js';

// The Spanish words for a rule an admin adds. Anything left empty shows in English, exactly as typed above.
export default function SpanishRuleFields({ idPrefix, value, onChange, open = false }) {
  const a = useA();
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <details className="es-fields" open={open}>
      <summary>{a('Spanish version (optional)', 'Versión en español (opcional)')}</summary>
      <p className="hint">{a('What people read when they switch the site to Spanish. Leave a box empty to show the English text.', 'Lo que ven las personas cuando cambian el sitio a español. Deje un cuadro vacío para mostrar el texto en inglés.')}</p>
      <div className="field"><label htmlFor={`${idPrefix}-title`}>{a('Requirement name in Spanish', 'Nombre del requisito en español')}</label><input id={`${idPrefix}-title`} type="text" value={value.title} onChange={set('title')} maxLength={200} /></div>
      <div className="field"><label htmlFor={`${idPrefix}-agency`}>{a('Agency in Spanish', 'Agencia en español')}</label><input id={`${idPrefix}-agency`} type="text" value={value.agency} onChange={set('agency')} maxLength={120} /></div>
      <div className="field"><label htmlFor={`${idPrefix}-detail`}>{a('Plain-language detail in Spanish', 'Detalle en lenguaje sencillo, en español')}</label><textarea id={`${idPrefix}-detail`} value={value.detail} onChange={set('detail')} maxLength={1000} /></div>
      <div className="field"><label htmlFor={`${idPrefix}-sl`}>{a('Source name in Spanish', 'Nombre de la fuente en español')}</label><input id={`${idPrefix}-sl`} type="text" value={value.sourceLabel} onChange={set('sourceLabel')} maxLength={200} /></div>
      <div className="field"><label htmlFor={`${idPrefix}-al`}>{a('Apply button text in Spanish', 'Texto del botón de solicitud en español')}</label><input id={`${idPrefix}-al`} type="text" value={value.applyLabel} onChange={set('applyLabel')} maxLength={120} /></div>
    </details>
  );
}
