import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useLoad } from '../api.js';
import { useApp } from '../AppContext.jsx';
import ChecklistItem from '../components/ChecklistItem.jsx';
import { Chips, ErrorNote, Loading, Meter } from '../components/Parts.jsx';
import { CAT_LABEL, STRUCT_LABEL, YN_LABEL, blankAnswers, countyLabel, stepList } from '../questions.js';

export default function Checklist() {
  const navigate = useNavigate();
  const { setAnswers, setLabel, setStep, setCatsAuto } = useApp();
  const fetchChecklist = useCallback(() => api.checklist(), []);
  const { data, error, loading, setData } = useLoad(fetchChecklist);
  const [actionError, setActionError] = useState('');

  async function toggle(ruleId, done) {
    setActionError('');
    try {
      setData(await api.setDone(ruleId, done));
    } catch (e) {
      setActionError(e.message);
    }
  }
  function editAnswers() {
    setAnswers({ ...blankAnswers(), ...data.answers, cats: [...data.answers.cats] });
    setLabel(data.label || '');
    setCatsAuto(false);
    setStep(stepList(data.answers).length - 1);
    navigate('/questionnaire');
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

  if (loading && !data) return <Loading what="Loading your checklist" />;
  if (error) return <ErrorNote message={error} />;

  if (!data?.saved) {
    return (
      <div className="empty">
        <h1 tabIndex={-1}>Your personalized checklist</h1>
        <p>You have not built a checklist yet. Answer the questions, or load a sample business.</p>
        <div className="row">
          <Link className="btn btn-primary" to="/questionnaire">Start the questionnaire</Link>
          <Link className="btn" to="/">Pick a sample</Link>
        </div>
      </div>
    );
  }

  const { answers, items, skipped, phases } = data;
  const done = items.filter((i) => i.done).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;
  const summary = [
    STRUCT_LABEL[answers.structure] || 'Structure not answered',
    ...answers.cats.map((c) => CAT_LABEL[c]),
    ...(answers.city ? [`City: ${answers.city}`] : []),
    ...(answers.county ? [`County: ${countyLabel(answers.county)}`] : []),
    `Hiring: ${YN_LABEL[answers.hiring] || 'not answered'}`,
    `Sales tax: ${YN_LABEL[answers.salestax] || 'not answered'}`,
    `Income $12,000 or more: ${YN_LABEL[answers.income] || 'not answered'}`,
    `Business name: ${YN_LABEL[answers.tradename] || 'not answered'}`,
  ];

  return (
    <>
      <div className="cl-head">
        <div>
          <h1 tabIndex={-1}>{data.label ? `Sample checklist: ${data.label}` : 'Your personalized checklist'}</h1>
          <p className="hint">Built by written rules from your answers.</p>
          <p className="hint" data-testid="badge-legend">
            "Source checked" means the official agency page was read on that date. It is not an approval from the agency.
            "Pending verification" means it has not been checked yet.
          </p>
          <Chips items={summary} />
        </div>
        <div className="row">
          <button type="button" className="btn btn-quiet btn-sm" onClick={editAnswers}>Edit answers</button>
          <Link className="btn btn-quiet btn-sm" to="/dashboard">See progress</Link>
          <button type="button" className="btn btn-quiet btn-sm" onClick={startOver}>Start over</button>
        </div>
        <div className="progress">
          <p id="prog-text">{done} of {items.length} steps marked done</p>
          <Meter percent={percent} labelledBy="prog-text" />
          <p className="hint">Simulated tracking. You tick steps yourself. Nothing is sent to any agency, and ticking a step does not mean an application was filed.</p>
        </div>
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
          <summary>Left out of your checklist ({skipped.length})</summary>
          <ul>
            {skipped.map((s) => <li key={s.ruleId}><strong>{s.title}.</strong> {s.reason}</li>)}
          </ul>
        </details>
      )}
    </>
  );
}
