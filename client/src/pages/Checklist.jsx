import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useLoad } from '../api.js';
import { useT } from '../i18n.js';
import { useApp } from '../AppContext.jsx';
import ChecklistItem from '../components/ChecklistItem.jsx';
import { Chips, ErrorNote, Loading, Meter } from '../components/Parts.jsx';
import { cardFromAnswers } from '../guideCard.js';
import { blankAnswers, stepList } from '../questions.js';

// embedded: used inside the My business page, which already shows the title and the progress summary.
export default function Checklist({ embedded = false, onChanged, onData } = {}) {
  const navigate = useNavigate();
  const t = useT();
  const { setAnswers, setLabel, setStep, setCatsAuto, setGuide } = useApp();
  const fetchChecklist = useCallback(() => api.checklist(), [t.lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, error, loading, setData } = useLoad(fetchChecklist);
  const [actionError, setActionError] = useState('');
  useEffect(() => { onData?.(data); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(ruleId, done) {
    setActionError('');
    try {
      setData(await api.setDone(ruleId, done));
      onChanged?.();
    } catch (e) {
      setActionError(e.message);
    }
  }
  function editAnswers() {
    setAnswers({ ...blankAnswers(), ...data.answers, cats: [...data.answers.cats] });
    setLabel(data.label || '');
    setCatsAuto(false);
    setStep(stepList(data.answers).length - 1);
    // Back to the home page with the saved answers loaded into "Your business", every row confirmed and editable.
    setGuide({ messages: [], card: cardFromAnswers(data.answers), ask: null, awaiting: null, complete: true, chips: [] });
    navigate('/', { state: { mode: 'type' } });
  }
  async function startOver() {
    try {
      await api.deleteChecklist();
      setAnswers(blankAnswers());
      setLabel('');
      setStep(0);
      navigate('/');
    } catch (e) {
      setActionError(e.message);
    }
  }

  if (loading && !data) return <Loading what={t('load.checklist')} />;
  if (error) return <ErrorNote message={error} />;

  if (!data?.saved) {
    if (embedded) return null;
    return (
      <div className="empty">
        <h1 tabIndex={-1}>{t('cl.title')}</h1>
        <p>{t('cl.none')}</p>
        <div className="row">
          <Link className="btn btn-primary" to="/questionnaire">{t('cl.start')}</Link>
          <Link className="btn" to="/">{t('cl.pick')}</Link>
        </div>
      </div>
    );
  }

  const { answers, items, skipped, phases } = data;
  const done = items.filter((i) => i.done).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;
  const summary = [
    t.card.structure[answers.structure] || t('cl.structNo'),
    ...answers.cats.map((c) => t.card.cat[c]),
    ...(answers.city ? [`${t('cl.city')}: ${answers.city}`] : []),
    ...(answers.county ? [`${t('cl.county')}: ${t.countyLabel(answers.county)}`] : []),
    `${t('cl.hiring')}: ${t.card.yn[answers.hiring] || t('cl.notAnswered')}`,
    `${t('cl.sales')}: ${t.card.yn[answers.salestax] || t('cl.notAnswered')}`,
    `${t('cl.income')}: ${t.card.yn[answers.income] || t('cl.notAnswered')}`,
    `${t('cl.name')}: ${t.card.yn[answers.tradename] || t('cl.notAnswered')}`,
  ];

  return (
    <>
      <div className="cl-head">
        <div>
          {embedded
            ? <h2 id="checklist-title">{data.label ? t('cl.sample', data.label) : t('cl.title')}</h2>
            : <h1 tabIndex={-1}>{data.label ? t('cl.sample', data.label) : t('cl.title')}</h1>}
          <p className="hint">{t('cl.built')}</p>
          {t.lang === 'es' && <p className="draft-note">{t('enNote')}</p>}
          <p className="hint" data-testid="badge-legend">
            {t('cl.legend')}
          </p>
          <Chips items={summary} />
        </div>
        <div className="row">
          <button type="button" className="btn btn-quiet btn-sm" onClick={editAnswers}>{t('cl.edit')}</button>
          {!embedded && <Link className="btn btn-quiet btn-sm" to="/my-business">{t('cl.progress')}</Link>}
          <button type="button" className="btn btn-quiet btn-sm" onClick={startOver}>{t('cl.over')}</button>
        </div>
        {!embedded && (
          <div className="progress">
            <p id="prog-text">{t('cl.steps', done, items.length)}</p>
            <Meter percent={percent} labelledBy="prog-text" />
            <p className="hint">{t('cl.simTrack')}</p>
          </div>
        )}
      </div>
      <ErrorNote message={actionError} />

      {Object.entries(phases).map(([p, name]) => {
        const inPhase = items.filter((i) => String(i.phase) === p);
        if (!inPhase.length) return null;
        return (
          <section className="phase" key={p} aria-labelledby={`ph${p}`}>
            <h2 id={`ph${p}`}>{name}</h2>
            <ul className="items">
              {inPhase.map((i) => <ChecklistItem key={i.id} item={i} onToggle={toggle} />)}
            </ul>
          </section>
        );
      })}

      {skipped.length > 0 && (
        <details>
          <summary>{t('cl.left', skipped.length)}</summary>
          <ul>
            {skipped.map((s) => <li key={s.ruleId}><strong>{s.title}.</strong> {s.reason}</li>)}
          </ul>
        </details>
      )}
    </>
  );
}
