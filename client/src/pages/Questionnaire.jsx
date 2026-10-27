import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { Meter } from '../components/Parts.jsx';
import CityCombobox, { countyForTypedCity } from '../components/CityCombobox.jsx';
import {
  CAT_LABEL, CATS, QUESTIONS, STRUCTURES, STRUCT_LABEL, YN, YN_FIELDS, YN_LABEL, WA_COUNTIES, countyLabel, stepList,
} from '../questions.js';

export default function Questionnaire() {
  const navigate = useNavigate();
  const { answers, setAnswers, label, setLabel, step, setStep, catsAuto, setCatsAuto } = useApp();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [countyFrom, setCountyFrom] = useState('');

  const list = stepList(answers);
  const index = Math.min(step, list.length - 1);
  const id = list[index];
  const q = QUESTIONS[id];
  const percent = Math.round((index / (list.length - 1)) * 100);
  const set = (patch) => setAnswers((a) => ({ ...a, ...patch }));

  async function next() {
    if (id === 'structure' && !answers.structure) return setErr('Please choose one option so we can continue.');
    if (YN_FIELDS.includes(id) && !answers[id]) return setErr('Please pick Yes, No or Not sure so we can continue.');
    setErr('');
    if (id === 'desc') {
      if (!answers.desc.trim()) {
        set({ cats: [] });
        setCatsAuto(false);
      } else if (!answers.cats.length || catsAuto) {
        try {
          const r = await api.suggest(answers.desc); // simulated keyword match on the server
          set({ cats: r.categories });
          setCatsAuto(true);
        } catch (e) {
          return setErr(e.message);
        }
      }
    }
    if (id === 'review') {
      setBusy(true);
      try {
        await api.saveChecklist(answers, label);
        navigate('/checklist');
      } catch (e) {
        setErr(e.message);
      } finally {
        setBusy(false);
      }
      return undefined;
    }
    setStep(index + 1);
    return undefined;
  }
  function back() {
    setErr('');
    if (index > 0) setStep(index - 1);
  }
  function toggleCat(v, on) {
    setCatsAuto(false);
    set({ cats: on ? [...answers.cats, v] : answers.cats.filter((c) => c !== v) });
  }

  let body;
  if (id === 'structure') {
    body = (
      <div className="opts">
        {STRUCTURES.map((o) => (
          <label key={o.v} className="opt">
            <input type="radio" name="structure" value={o.v} checked={answers.structure === o.v} onChange={() => set({ structure: o.v })} />
            <span>{o.t}{o.d && <small>{o.d}</small>}</span>
          </label>
        ))}
      </div>
    );
  } else if (id === 'desc') {
    body = (
      <>
        <label htmlFor="f-desc" className="hint">Describe your business</label>
        <textarea id="f-desc" value={answers.desc} onChange={(e) => set({ desc: e.target.value })} placeholder="Example: Mobile dog grooming from a van" maxLength={500} />
        {!answers.desc.trim() && <p className="hint">You can leave this blank. You will still choose your business type next.</p>}
      </>
    );
  } else if (id === 'cats') {
    body = (
      <>
        <div className="opts">
          {CATS.map((o) => (
            <label key={o.v} className="opt">
              <input type="checkbox" name="cats" value={o.v} checked={answers.cats.includes(o.v)} onChange={(e) => toggleCat(o.v, e.target.checked)} />
              <span>{o.t}<small>{o.d}</small></span>
            </label>
          ))}
        </div>
        <p className="note">{answers.desc.trim() ? 'Preselected by a simple keyword match on your words (simulated, no AI). Change it if it is wrong.' : 'Nothing is preselected. Choose what fits.'}</p>
      </>
    );
  } else if (id === 'city') {
    body = (
      <>
        <label htmlFor="f-city" className="hint">City</label>
        <CityCombobox
          id="f-city" value={answers.city} placeholder="Start typing, for example Bel"
          onChange={(city) => {
            const c = !answers.county.trim() ? countyForTypedCity(city) : '';
            set(c ? { city, county: c } : { city });
            setCountyFrom(c ? `${city.trim()} is in ${c} County.` : '');
          }}
          onPick={(o) => { set({ city: o.name, county: o.county }); setCountyFrom(`${o.name} is in ${o.county} County.`); }}
        />
        <label htmlFor="f-county" className="hint" style={{ marginTop: '1rem', display: 'block' }}>County</label>
        <input type="text" id="f-county" list="wa-counties" autoComplete="off" value={answers.county} onChange={(e) => { set({ county: e.target.value }); setCountyFrom(''); }} placeholder="Filled from your city, or type to change" maxLength={80} />
        {countyFrom && <p className="hint" role="status">{countyFrom} Check it is right. You can change it.</p>}
        <datalist id="wa-counties">
          {WA_COUNTIES.map((c) => <option key={c} value={c} />)}
        </datalist>
        <p className="note">City and county suggestions only help you type. They come from a ZIP code list, not an official county source, and a city can sit in more than one county. Choosing a county does not confirm any requirement.</p>
      </>
    );
  } else if (id === 'review') {
    const rows = [
      ['Structure', 'structure', STRUCT_LABEL[answers.structure] || 'Not answered'],
      ['Business description', 'desc', answers.desc.trim() || 'Not provided'],
      ['Business type', 'cats', answers.cats.length ? answers.cats.map((c) => CAT_LABEL[c]).join(', ') : 'None selected'],
      ['City', 'city', answers.city.trim() || 'Not provided'],
      ['County', 'county', countyLabel(answers.county) || 'Not provided'],
      ['Hiring within 90 days', 'hiring', YN_LABEL[answers.hiring] || 'Not answered'],
      ['Subcontractors', 'subs', YN_LABEL[answers.subs] || 'Not answered'],
      ['Collects sales tax', 'salestax', YN_LABEL[answers.salestax] || 'Not answered'],
      ['Income $12,000 a year or more', 'income', YN_LABEL[answers.income] || 'Not answered'],
      ['Uses a business name', 'tradename', YN_LABEL[answers.tradename] || 'Not answered'],
    ];
    body = (
      <dl className="summary">
        {rows.map(([name, key, value]) => (
          <div key={key}>
            <div><dt>{name}</dt><dd>{value}</dd></div>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setErr(''); setStep(list.indexOf(key === 'county' ? 'city' : key)); }}>Change</button>
          </div>
        ))}
      </dl>
    );
  } else {
    body = (
      <div className="opts">
        {YN.map((o) => (
          <label key={o.v} className="opt">
            <input type="radio" name={id} value={o.v} checked={answers[id] === o.v} onChange={() => set({ [id]: o.v })} />
            <span>{o.t}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="panel">
      <h1 className="sr-only" tabIndex={-1}>Business questionnaire</h1>
      <p className="step-label">Question {index + 1} of {list.length}</p>
      <Meter percent={percent} label="Questionnaire progress" />
      <fieldset>
        <legend>{q.title}</legend>
        {q.hint && <p className="hint">{q.hint}</p>}
        {body}
      </fieldset>
      <p className="err" role="alert">{err}</p>
      <div className="nav-row">
        <button type="button" className="btn btn-quiet" onClick={back} disabled={index === 0}>Back</button>
        <button type="button" className="btn btn-primary" onClick={next} disabled={busy}>
          {id === 'review' ? 'Build my checklist' : 'Next'}
        </button>
      </div>
    </div>
  );
}
