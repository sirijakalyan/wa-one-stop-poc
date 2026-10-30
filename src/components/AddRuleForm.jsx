import { useState } from 'react';
import { api } from '../api.js';
import { ErrorNote } from './Parts.jsx';
import AppliesPicker from './AppliesPicker.jsx';

const BLANK = { title: '', agency: '', phase: '', detail: '', sourceLabel: '', sourceUrl: '', applyLabel: '', applyUrl: '' };

// Add a new requirement. It goes live straight away, marked "Pending verification" until a second person checks it.
export default function AddRuleForm({ phases, fields, onAdded, onCancel }) {
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
      <h2 id="add-rule-h">Add a rule</h2>
      <p className="hint">The new step is live for the people it applies to right away. It shows "Pending verification" until a second person checks it against the official page.</p>
      <div className="field"><label htmlFor="ar-title">Requirement name</label><input id="ar-title" type="text" value={f.title} onChange={set('title')} maxLength={200} required /></div>
      <div className="field"><label htmlFor="ar-agency">Agency</label><input id="ar-agency" type="text" value={f.agency} onChange={set('agency')} maxLength={120} required /></div>
      <div className="field">
        <label htmlFor="ar-phase">Where it belongs on the road to opening day</label>
        <select id="ar-phase" value={f.phase} onChange={set('phase')} required>
          <option value="">Choose one</option>
          {Object.entries(phases).map(([k, name]) => <option key={k} value={k}>{name}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="ar-detail">Plain-language detail</label><textarea id="ar-detail" value={f.detail} onChange={set('detail')} maxLength={1000} /></div>
      <div className="field"><label htmlFor="ar-sl">Source name</label><input id="ar-sl" type="text" value={f.sourceLabel} onChange={set('sourceLabel')} maxLength={200} placeholder="For example: FAA, Register your drone" /></div>
      <div className="field"><label htmlFor="ar-su">Source link (https)</label><input id="ar-su" type="text" value={f.sourceUrl} onChange={set('sourceUrl')} required placeholder="https://" /></div>
      <div className="field"><label htmlFor="ar-al">Apply button text</label><input id="ar-al" type="text" value={f.applyLabel} onChange={set('applyLabel')} maxLength={120} placeholder="Optional" /></div>
      <div className="field"><label htmlFor="ar-au">Apply link (https)</label><input id="ar-au" type="text" value={f.applyUrl} onChange={set('applyUrl')} placeholder="Optional" /></div>
      <AppliesPicker idPrefix="ar" fields={fields} value={applies} onChange={setApplies} />
      <ErrorNote message={err} />
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>Add this rule</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
