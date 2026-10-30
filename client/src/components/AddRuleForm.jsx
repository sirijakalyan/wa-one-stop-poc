import { useState } from 'react';
import { api } from '../api.js';
import { ErrorNote } from './Parts.jsx';
import AppliesPicker from './AppliesPicker.jsx';
import { useA } from '../adminText.js';

const BLANK = { title: '', agency: '', phase: '', detail: '', sourceLabel: '', sourceUrl: '', applyLabel: '', applyUrl: '' };

// Add a new requirement. It goes live straight away, marked "Pending verification" until a second person checks it.
export default function AddRuleForm({ phases, fields, onAdded, onCancel }) {
  const a = useA();
  const [f, setF] = useState(BLANK);
  const [applies, setApplies] = useState({ mode: 'always', field: '', value: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const res = await api.addRule({ ...f, phase: Number(f.phase), applies });
      onAdded(res);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel add-rule" onSubmit={submit} aria-labelledby="add-rule-h">
      <h2 id="add-rule-h">{a('Add a rule', 'Agregar una regla')}</h2>
      <p className="hint">{a('The new step is live for the people it applies to right away. It shows "Pending verification" until a second person checks it against the official page.', 'El nuevo paso se ve de inmediato para las personas a quienes aplica. Muestra "Verificación pendiente" hasta que una segunda persona lo revise contra la página oficial.')}</p>
      <div className="field"><label htmlFor="ar-title">{a('Requirement name', 'Nombre del requisito')}</label><input id="ar-title" type="text" value={f.title} onChange={set('title')} maxLength={200} required /></div>
      <div className="field"><label htmlFor="ar-agency">{a('Agency', 'Agencia')}</label><input id="ar-agency" type="text" value={f.agency} onChange={set('agency')} maxLength={120} required /></div>
      <div className="field">
        <label htmlFor="ar-phase">{a('Where it belongs on the road to opening day', 'Dónde va en el camino al día de apertura')}</label>
        <select id="ar-phase" value={f.phase} onChange={set('phase')} required>
          <option value="">{a('Choose one', 'Elija una')}</option>
          {Object.entries(phases).map(([k, name]) => <option key={k} value={k}>{name}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="ar-detail">{a('Plain-language detail', 'Detalle en lenguaje sencillo')}</label><textarea id="ar-detail" value={f.detail} onChange={set('detail')} maxLength={1000} /></div>
      <div className="field"><label htmlFor="ar-sl">{a('Source name', 'Nombre de la fuente')}</label><input id="ar-sl" type="text" value={f.sourceLabel} onChange={set('sourceLabel')} maxLength={200} placeholder={a('For example: FAA, Register your drone', 'Por ejemplo: FAA, Registre su dron')} /></div>
      <div className="field"><label htmlFor="ar-su">{a('Source link (https)', 'Enlace de la fuente (https)')}</label><input id="ar-su" type="text" value={f.sourceUrl} onChange={set('sourceUrl')} required placeholder="https://" /></div>
      <div className="field"><label htmlFor="ar-al">{a('Apply button text', 'Texto del botón de solicitud')}</label><input id="ar-al" type="text" value={f.applyLabel} onChange={set('applyLabel')} maxLength={120} placeholder={a('Optional', 'Opcional')} /></div>
      <div className="field"><label htmlFor="ar-au">{a('Apply link (https)', 'Enlace de solicitud (https)')}</label><input id="ar-au" type="text" value={f.applyUrl} onChange={set('applyUrl')} placeholder={a('Optional', 'Opcional')} /></div>
      <AppliesPicker idPrefix="ar" fields={fields} value={applies} onChange={setApplies} />
      <ErrorNote message={err} />
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>{a('Add this rule', 'Agregar esta regla')}</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>{a('Cancel', 'Cancelar')}</button>
      </div>
    </form>
  );
}
