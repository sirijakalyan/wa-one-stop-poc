import { useCallback, useState } from 'react';
import { api, useLoad } from '../api.js';
import { ErrorNote, Loading } from '../components/Parts.jsx';
import { QUESTIONS } from '../questions.js';
import { useA } from '../adminText.js';
import { useT } from '../i18n.js';

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
  const a = useA();
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
      <div className="field"><label htmlFor={`${id}-t`}>{a('Question', 'Pregunta')}</label><input id={`${id}-t`} type="text" value={f.text} maxLength={200} required onChange={(e) => setF({ ...f, text: e.target.value })} placeholder={a('For example: Will you fly drones for work?', 'Por ejemplo: ¿Usará drones para trabajar?')} /></div>
      <div className="field"><label htmlFor={`${id}-h`}>{a('Help text (optional)', 'Texto de ayuda (opcional)')}</label><input id={`${id}-h`} type="text" value={f.hint} maxLength={300} onChange={(e) => setF({ ...f, hint: e.target.value })} placeholder={a('Shown under the question', 'Se muestra debajo de la pregunta')} /></div>
      {!editing && (
        <fieldset>
          <legend>{a('Answers', 'Respuestas')}</legend>
          <label className="opt"><input type="radio" name={`${id}-type`} checked={f.type === 'yesno'} onChange={() => setF({ ...f, type: 'yesno' })} /><span>{a('Yes, No or Not sure', 'Sí, No o No estoy seguro')}</span></label>
          <label className="opt"><input type="radio" name={`${id}-type`} checked={f.type === 'choice'} onChange={() => setF({ ...f, type: 'choice' })} /><span>{a('Pick one from a list I write', 'Elegir una de una lista que yo escriba')}</span></label>
        </fieldset>
      )}
      {f.type === 'choice' && (
        <div className="field">
          <label htmlFor={`${id}-o`}>{a('Choices, one per line (2 to 8)', 'Opciones, una por línea (de 2 a 8)')}</label>
          <textarea id={`${id}-o`} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} rows={5} placeholder={a('Online\nStorefront\nFarmers market', 'En línea\nTienda\nMercado agrícola')} />
          <p className="hint">{a('"Not sure" is added at the end for you.', 'Se agrega "No estoy seguro" al final por usted.')}</p>
        </div>
      )}
      <ErrorNote message={err} />
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>{editing ? a('Save changes', 'Guardar cambios') : a('Add this question', 'Agregar esta pregunta')}</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>{a('Cancel', 'Cancelar')}</button>
      </div>
    </form>
  );
}

export default function AdminQuestions() {
  const a = useA();
  const t = useT();
  const fetchQ = useCallback(() => api.questions(), []);
  const { data, error, loading, reload } = useLoad(fetchQ);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState('');
  if (loading && !data) return <Loading what={a('Loading questions', 'Cargando preguntas')} />;
  if (error) return <ErrorNote message={error} />;
  const questions = data?.questions ?? [];

  const toBody = (f) => ({ text: f.text, hint: f.hint, type: f.type, options: f.type === 'choice' ? linesOf(f.options) : undefined });
  async function remove(q) {
    setErr(''); setMsg('');
    try { await api.removeQuestion(q.id); setConfirm(''); setMsg(a('Question removed. Answers people already gave to it are ignored.', 'Pregunta eliminada. Se ignoran las respuestas que ya se dieron.')); await reload(); } catch (e) { setErr(e.message); setConfirm(''); }
  }

  return (
    <>
      <header className="desk-head">
        <h1 tabIndex={-1}>{a('Questions', 'Preguntas')}</h1>
        <p className="lead">{a('Add your own questions. Everyone sees them after the standard ones, in the step-by-step form and in the guide. A rule can then use the answer to decide who sees it.', 'Agregue sus propias preguntas. Todos las ven después de las estándar, en el formulario paso a paso y en la guía. Una regla puede usar la respuesta para decidir quién la ve.')}</p>
      </header>
      {msg && <p className="ok" role="status">{msg}</p>}
      <ErrorNote message={err} />

      <section aria-labelledby="yq-h" className="q-section">
        <div className="q-section-head">
          <h2 id="yq-h">{a('Your questions', 'Sus preguntas')} ({questions.length})</h2>
          {!adding && <button type="button" className="btn btn-primary btn-sm" onClick={() => { setAdding(true); setEditing(''); setMsg(''); }}>{a('Add a question', 'Agregar una pregunta')}</button>}
        </div>
        {adding && (
          <QuestionForm
            initial={BLANK}
            onCancel={() => setAdding(false)}
            onSave={async (f) => { await api.addQuestion(toBody(f)); setAdding(false); setMsg(a('Question added. Everyone sees it now. Next, add a rule that uses the answer in the Rules tab.', 'Pregunta agregada. Todos la ven ahora. Después, agregue en la pestaña Reglas una regla que use la respuesta.')); await reload(); }}
          />
        )}
        {questions.length === 0 && !adding && <p className="desk-empty">{a('No questions of your own yet. Add one and it appears for everyone after the standard questions.', 'Aún no hay preguntas propias. Agregue una y aparecerá para todos después de las preguntas estándar.')}</p>}
        <ul className="q-list">
          {questions.map((q, i) => (
            <li key={q.id} className="q-card">
              {editing === q.id ? (
                <QuestionForm
                  editing={q.id}
                  initial={{ text: q.text, hint: q.hint, type: q.type, options: q.options.filter((o) => o.value !== 'unsure').map((o) => o.label).join('\n') }}
                  onCancel={() => setEditing('')}
                  onSave={async (f) => { await api.editQuestion(q.id, { text: f.text, hint: f.hint, options: f.type === 'choice' ? optionsFromLines(f.options, q.options.filter((o) => o.value !== 'unsure')) : undefined }); setEditing(''); setMsg(a('Question saved.', 'Pregunta guardada.')); await reload(); }}
                />
              ) : (
                <>
                  <p className="q-no">{a('Question', 'Pregunta')} {i + 1}</p>
                  <h3>{q.text}</h3>
                  {q.hint && <p className="hint">{q.hint}</p>}
                  <p className="q-opts">{q.options.map((o) => <span key={o.value} className="q-opt">{a.lang === 'es' && ((o.value === 'yes' && o.label === 'Yes') || (o.value === 'no' && o.label === 'No') || (o.value === 'unsure' && o.label === 'Not sure')) ? { yes: 'Sí', no: 'No', unsure: 'No estoy seguro' }[o.value] : o.label}</span>)}</p>
                  <div className="row">
                    <button type="button" className="btn btn-sm" onClick={() => { setEditing(q.id); setAdding(false); setMsg(''); }}>{a('Edit', 'Editar')}<span className="sr-only"> {q.text}</span></button>
                    {confirm === q.id ? (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => remove(q)}>{a('Yes, remove it', 'Sí, eliminarla')}</button>
                        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirm('')}>{a('Keep it', 'Conservarla')}</button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirm(q.id)}>{a('Remove', 'Eliminar')}<span className="sr-only"> {q.text}</span></button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <details className="desk-more-one">
        <summary>{a('The standard questions everyone is asked first', 'Las preguntas estándar que se hacen primero a todos')}</summary>
        <ol className="q-standard">
          {STANDARD.map((k) => <li key={k}>{a.lang === 'es' ? t(`qn.q.${k}.t`) : QUESTIONS[k].title}</li>)}
        </ol>
        <p className="hint">{a('These are built in and cannot be changed here. Rules can still use them to decide who sees a step.', 'Estas vienen integradas y no se pueden cambiar aquí. Las reglas aún pueden usarlas para decidir quién ve un paso.')}</p>
      </details>
    </>
  );
}
