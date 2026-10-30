import { useCallback, useState } from 'react';
import { api, useLoad } from '../api.js';
import { ErrorNote, Loading } from '../components/Parts.jsx';
import { QUESTIONS } from '../questions.js';

const STANDARD = ['structure', 'desc', 'cats', 'city', 'hiring', 'subs', 'salestax', 'income', 'tradename'];
const BLANK = { text: '', hint: '', type: 'yesno', options: '' };
const linesOf = (txt) => txt.split('\n').map((l) => l.trim()).filter(Boolean);

// Edited lines back to options. A line that still reads the same keeps its option, a reworded line in the same place keeps
// the option too (so answers people already gave still count), and a new line becomes a new option.
function optionsFromLines(text, existing) {
  const lines = linesOf(text);
  const labels = new Set(lines.map((l) => l.toLowerCase()));
  return lines.map((label, i) => {
    const same = existing.find((o) => o.label.toLowerCase() === label.toLowerCase());
    if (same) return { value: same.value, label };
    const slot = existing[i];
    if (slot && !labels.has(slot.label.toLowerCase())) return { value: slot.value, label };
    return { label };
  });
}

function QuestionForm({ initial, editing, onSave, onCancel }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await onSave(f); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  const id = editing ? `eq-${editing}` : 'nq';
  return (
    <form className="panel q-form" onSubmit={submit}>
      <div className="field"><label htmlFor={`${id}-t`}>Question</label><input id={`${id}-t`} type="text" value={f.text} maxLength={200} required onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="For example: Will you fly drones for work?" /></div>
      <div className="field"><label htmlFor={`${id}-h`}>Help text (optional)</label><input id={`${id}-h`} type="text" value={f.hint} maxLength={300} onChange={(e) => setF({ ...f, hint: e.target.value })} placeholder="Shown under the question" /></div>
      {!editing && (
        <fieldset>
          <legend>Answers</legend>
          <label className="opt"><input type="radio" name={`${id}-type`} checked={f.type === 'yesno'} onChange={() => setF({ ...f, type: 'yesno' })} /><span>Yes, No or Not sure</span></label>
          <label className="opt"><input type="radio" name={`${id}-type`} checked={f.type === 'choice'} onChange={() => setF({ ...f, type: 'choice' })} /><span>Pick one from a list I write</span></label>
        </fieldset>
      )}
      {f.type === 'choice' && (
        <div className="field">
          <label htmlFor={`${id}-o`}>Choices, one per line (2 to 8)</label>
          <textarea id={`${id}-o`} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} rows={5} placeholder={'Online\nStorefront\nFarmers market'} />
          <p className="hint">"Not sure" is added at the end for you.</p>
        </div>
      )}
      <ErrorNote message={err} />
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>{editing ? 'Save changes' : 'Add this question'}</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function AdminQuestions() {
  const fetchQ = useCallback(() => api.questions(), []);
  const { data, error, loading, reload } = useLoad(fetchQ);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState('');
  if (loading && !data) return <Loading what="Loading questions" />;
  if (error) return <ErrorNote message={error} />;
  const questions = data?.questions ?? [];

  const toBody = (f) => ({ text: f.text, hint: f.hint, type: f.type, options: f.type === 'choice' ? linesOf(f.options) : undefined });
  async function remove(q) {
    setErr(''); setMsg('');
    try { await api.removeQuestion(q.id); setConfirm(''); setMsg('Question removed. Answers people already gave to it are ignored.'); await reload(); } catch (e) { setErr(e.message); setConfirm(''); }
  }

  return (
    <>
      <header className="desk-head">
        <h1 tabIndex={-1}>Questions</h1>
        <p className="lead">Add your own questions. Everyone sees them after the standard ones, in the step-by-step form and in the guide. A rule can then use the answer to decide who sees it.</p>
      </header>
      {msg && <p className="ok" role="status">{msg}</p>}
      <ErrorNote message={err} />

      <section aria-labelledby="yq-h" className="q-section">
        <div className="q-section-head">
          <h2 id="yq-h">Your questions ({questions.length})</h2>
          {!adding && <button type="button" className="btn btn-primary btn-sm" onClick={() => { setAdding(true); setEditing(''); setMsg(''); }}>Add a question</button>}
        </div>
        {adding && (
          <QuestionForm
            initial={BLANK}
            onCancel={() => setAdding(false)}
            onSave={async (f) => { await api.addQuestion(toBody(f)); setAdding(false); setMsg('Question added. Everyone sees it now. Next, add a rule that uses the answer in the Rules room.'); await reload(); }}
          />
        )}
        {questions.length === 0 && !adding && <p className="desk-empty">No questions of your own yet. Add one and it appears for everyone after the standard questions.</p>}
        <ul className="q-list">
          {questions.map((q, i) => (
            <li key={q.id} className="q-card">
              {editing === q.id ? (
                <QuestionForm
                  editing={q.id}
                  initial={{ text: q.text, hint: q.hint, type: q.type, options: q.options.filter((o) => o.value !== 'unsure').map((o) => o.label).join('\n') }}
                  onCancel={() => setEditing('')}
                  onSave={async (f) => { await api.editQuestion(q.id, { text: f.text, hint: f.hint, options: f.type === 'choice' ? optionsFromLines(f.options, q.options.filter((o) => o.value !== 'unsure')) : undefined }); setEditing(''); setMsg('Question saved.'); await reload(); }}
                />
              ) : (
                <>
                  <p className="q-no">Question {i + 1}</p>
                  <h3>{q.text}</h3>
                  {q.hint && <p className="hint">{q.hint}</p>}
                  <p className="q-opts">{q.options.map((o) => <span key={o.value} className="q-opt">{o.label}</span>)}</p>
                  <div className="row">
                    <button type="button" className="btn btn-sm" onClick={() => { setEditing(q.id); setAdding(false); setMsg(''); }}>Edit<span className="sr-only"> {q.text}</span></button>
                    {confirm === q.id ? (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => remove(q)}>Yes, remove it</button>
                        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirm('')}>Keep it</button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirm(q.id)}>Remove<span className="sr-only"> {q.text}</span></button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <details className="desk-more-one">
        <summary>The standard questions everyone is asked first</summary>
        <ol className="q-standard">
          {STANDARD.map((k) => <li key={k}>{QUESTIONS[k].title}</li>)}
        </ol>
        <p className="hint">These are built in and cannot be changed here. Rules can still use them to decide who sees a step.</p>
      </details>
    </>
  );
}
