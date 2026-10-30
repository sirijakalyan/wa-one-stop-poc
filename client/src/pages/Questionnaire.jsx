import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useLoad } from '../api.js';
import { useT } from '../i18n.js';
import { useApp } from '../AppContext.jsx';
import { Meter } from '../components/Parts.jsx';
import CityCombobox, { countyForTypedCity } from '../components/CityCombobox.jsx';
import { CATS, STRUCTURES, YN, YN_FIELDS, WA_COUNTIES, stepList } from '../questions.js';

export default function Questionnaire({ embedded = false } = {}) {
  const navigate = useNavigate();
  const t = useT();
  const { user, requireLogin, answers, setAnswers, label, setLabel, step, setStep, catsAuto, setCatsAuto } = useApp();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [countyFrom, setCountyFrom] = useState('');

  const { data: extraData } = useLoad(useCallback(() => api.questions().catch(() => ({ questions: [] })), []));
  const extraQs = extraData?.questions ?? [];
  const list = stepList(answers, extraQs.map((x) => x.id));
  const index = Math.min(step, list.length - 1);
  const id = list[index];
  const custom = id.startsWith('x:') ? extraQs.find((x) => x.id === id.slice(2)) : null;
  const q = custom ? { title: custom.text, hint: custom.hint } : { title: t(`qn.q.${id}.t`), hint: t(`qn.q.${id}.h`) };
  const extraOf = (qid) => answers.extra?.[qid] || '';
  const percent = Math.round((index / (list.length - 1)) * 100);
  const set = (patch) => setAnswers((a) => ({ ...a, ...patch }));

  async function next() {
    if (id === 'structure' && !answers.structure) return setErr(t('qn.pickOne'));
    if (YN_FIELDS.includes(id) && !answers[id]) return setErr(t('qn.pickYn'));
    if (custom && !extraOf(custom.id)) return setErr(t('qn.pickOne'));
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
      if (requireLogin && !user) return navigate('/login', { state: { from: '/questionnaire' } });
      setBusy(true);
      try {
        await api.saveBusiness(answers, label);
        navigate('/my-business');
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
            <span>{t.card.structureOptions[o.v]}{o.d && <small>{t(`qn.struct.${o.v}.d`)}</small>}</span>
          </label>
        ))}
      </div>
    );
  } else if (id === 'desc') {
    body = (
      <>
        <label htmlFor="f-desc" className="hint">{t('qn.desc')}</label>
        <textarea id="f-desc" value={answers.desc} onChange={(e) => set({ desc: e.target.value })} placeholder={t('qn.descPh')} maxLength={500} />
        {!answers.desc.trim() && <p className="hint">{t('qn.descBlank')}</p>}
      </>
    );
  } else if (id === 'cats') {
    body = (
      <>
        <div className="opts">
          {CATS.map((o) => (
            <label key={o.v} className="opt">
              <input type="checkbox" name="cats" value={o.v} checked={answers.cats.includes(o.v)} onChange={(e) => toggleCat(o.v, e.target.checked)} />
              <span>{t.card.cat[o.v]}<small>{t(`qn.cat.${o.v}.d`)}</small></span>
            </label>
          ))}
        </div>
        <p className="note">{answers.desc.trim() ? t('qn.catAuto') : t('qn.catNone')}</p>
      </>
    );
  } else if (id === 'city') {
    body = (
      <>
        <label htmlFor="f-city" className="hint">{t('qn.city')}</label>
        <CityCombobox
          id="f-city" value={answers.city} placeholder={t('qn.cityPh')}
          onChange={(city) => {
            const c = !answers.county.trim() ? countyForTypedCity(city) : '';
            set(c ? { city, county: c } : { city });
            setCountyFrom(c ? t('qn.cityIn', city.trim(), c) : '');
          }}
          onPick={(o) => { set({ city: o.name, county: o.county }); setCountyFrom(t('qn.cityIn', o.name, o.county)); }}
        />
        <label htmlFor="f-county" className="hint" style={{ marginTop: '1rem', display: 'block' }}>{t('qn.county')}</label>
        <input type="text" id="f-county" list="wa-counties" autoComplete="off" value={answers.county} onChange={(e) => { set({ county: e.target.value }); setCountyFrom(''); }} placeholder={t('qn.countyPh')} maxLength={80} />
        {countyFrom && <p className="hint" role="status">{countyFrom} {t('qn.check')}</p>}
        <datalist id="wa-counties">
          {WA_COUNTIES.map((c) => <option key={c} value={c} />)}
        </datalist>
        <p className="note">{t('qn.cityNote')}</p>
      </>
    );
  } else if (id === 'review') {
    const rows = [
      [t('qn.r.structure'), 'structure', t.card.structure[answers.structure] || t('qn.notAnswered')],
      [t('qn.r.desc'), 'desc', answers.desc.trim() || t('qn.notProvided')],
      [t('qn.r.cats'), 'cats', answers.cats.length ? answers.cats.map((c) => t.card.cat[c]).join(', ') : t('qn.noneSelected')],
      [t('qn.r.city'), 'city', answers.city.trim() || t('qn.notProvided')],
      [t('qn.r.county'), 'county', t.countyLabel(answers.county) || t('qn.notProvided')],
      [t('qn.r.hiring'), 'hiring', t.card.yn[answers.hiring] || t('qn.notAnswered')],
      [t('qn.r.subs'), 'subs', t.card.yn[answers.subs] || t('qn.notAnswered')],
      [t('qn.r.salestax'), 'salestax', t.card.yn[answers.salestax] || t('qn.notAnswered')],
      [t('qn.r.income'), 'income', t.card.yn[answers.income] || t('qn.notAnswered')],
      [t('qn.r.tradename'), 'tradename', t.card.yn[answers.tradename] || t('qn.notAnswered')],
      ...extraQs.map((x) => [x.text, `x:${x.id}`, x.options.find((o) => o.value === extraOf(x.id))?.label || t('qn.notAnswered')]),
    ];
    body = (
      <dl className="summary">
        {rows.map(([name, key, value]) => (
          <div key={key}>
            <div><dt>{name}</dt><dd>{value}</dd></div>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setErr(''); setStep(list.indexOf(key === 'county' ? 'city' : key)); }}>{t('qn.change')}</button>
          </div>
        ))}
      </dl>
    );
  } else if (custom) {
    body = (
      <div className="opts">
        {custom.options.map((o) => (
          <label key={o.value} className="opt">
            <input type="radio" name={id} value={o.value} checked={extraOf(custom.id) === o.value} onChange={() => set({ extra: { ...(answers.extra || {}), [custom.id]: o.value } })} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    );
  } else {
    body = (
      <div className="opts">
        {YN.map((o) => (
          <label key={o.v} className="opt">
            <input type="radio" name={id} value={o.v} checked={answers[id] === o.v} onChange={() => set({ [id]: o.v })} />
            <span>{t.card.yn[o.v]}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="panel">
      {embedded
        ? <h2 className="sr-only" tabIndex={-1}>{t('qn.h1')}</h2>
        : <h1 className="sr-only" tabIndex={-1}>{t('qn.h1')}</h1>}
      <p className="step-label">{t('qn.label', index + 1, list.length)}</p>
      <Meter percent={percent} label={t('qn.progress')} />
      <fieldset>
        <legend>{q.title}</legend>
        {q.hint && <p className="hint">{q.hint}</p>}
        {body}
      </fieldset>
      <p className="err" role="alert">{err}</p>
      <div className="nav-row">
        <button type="button" className="btn btn-quiet" onClick={back} disabled={index === 0}>{t('qn.back')}</button>
        <button type="button" className="btn btn-primary" onClick={next} disabled={busy}>
          {id === 'review' ? t('qn.build') : t('qn.next')}
        </button>
      </div>
    </div>
  );
}
