import { useA } from '../adminText.js';

// "Who sees this step": everyone, or only people who gave one particular answer to one question.
// fields: [{ field, text, options: [{ value, label }] }] from /api/rule-fields. "Not sure" is left out on purpose:
// someone who is not sure automatically gets the step marked "may apply".
export default function AppliesPicker({ idPrefix, fields, value, onChange }) {
  const a = useA();
  const f = fields.find((x) => x.field === value.field);
  const answers = (f?.options || []).filter((o) => o.value !== 'unsure');
  return (
    <fieldset className="applies-picker">
      <legend>{a('Who sees this step', 'Quién ve este paso')}</legend>
      <label className="opt">
        <input type="radio" name={`${idPrefix}-mode`} checked={value.mode === 'always'} onChange={() => onChange({ mode: 'always', field: '', value: '' })} />
        <span>{a('Everyone', 'Todos')}</span>
      </label>
      <label className="opt">
        <input type="radio" name={`${idPrefix}-mode`} checked={value.mode === 'when'} onChange={() => { const first = fields[0]; onChange({ mode: 'when', field: first?.field || '', value: first?.options.find((o) => o.value !== 'unsure')?.value || '' }); }} />
        <span>{a('Only people who give a certain answer', 'Solo quienes den cierta respuesta')}</span>
      </label>
      {value.mode === 'when' && (
        <div className="applies-when">
          <div className="field">
            <label htmlFor={`${idPrefix}-field`}>{a('Question', 'Pregunta')}</label>
            <select id={`${idPrefix}-field`} value={value.field} onChange={(e) => { const nf = fields.find((x) => x.field === e.target.value); onChange({ mode: 'when', field: e.target.value, value: nf?.options.find((o) => o.value !== 'unsure')?.value || '' }); }}>
              {fields.map((x) => <option key={x.field} value={x.field}>{x.text}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${idPrefix}-value`}>{a('The answer is', 'La respuesta es')}</label>
            <select id={`${idPrefix}-value`} value={value.value} onChange={(e) => onChange({ ...value, value: e.target.value })}>
              {answers.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <p className="hint">{a('People who answer "Not sure" see the step marked "may apply".', 'Quienes respondan "No estoy seguro" ven el paso marcado como "puede aplicar".')}</p>
        </div>
      )}
    </fieldset>
  );
}

// A saved condition turned back into what the picker edits.
export function pickerFrom(applies) {
  if (!applies || applies.always) return { mode: 'always', field: '', value: '' };
  return { mode: 'when', field: applies.field, value: applies.is ?? applies.includes ?? '' };
}
