import { useCallback, useState } from 'react';
import { api, useLoad } from '../api.js';
import { ErrorNote, Loading } from '../components/Parts.jsx';
import { useA } from '../adminText.js';
import { useT } from '../i18n.js';

const BLANK = { text: '', hint: '', type: 'yesno', options: '', es: { text: '', hint: '', options: '' } };
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

const STD_KEY = { structure: 'structure', activity: 'desc', place: 'city', hiring: 'hiring', subs: 'subs', salestax: 'salestax', income: 'income', tradename: 'tradename' };

// Reword one standard question. Anything left empty keeps the built-in wording.
function StandardForm({ item, onSave, onCancel }) {
  const a = useA();
  const [f, setF] = useState({ label: item.en.label, text: item.en.text, hint: item.en.hint, es: { ...item.es } });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function go(body) {
    setErr(''); setBusy(true);
    try { await onSave(body); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  const id = `sq-${item.field}`;
  const setEs = (k, v) => setF({ ...f, es: { ...f.es, [k]: v } });
  return (
    <form className="panel q-form" onSubmit={(e) => { e.preventDefault(); go(f); }}>
      <div className="field"><label htmlFor={`${id}-t`}>{a('Question', 'Pregunta')}</label><input id={`${id}-t`} type="text" value={f.text} maxLength={200} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder={item.defaults.text} /></div>
      <div className="field"><label htmlFor={`${id}-l`}>{a('Short name on the business card', 'Nombre corto en la tarjeta del negocio')}</label><input id={`${id}-l`} type="text" value={f.label} maxLength={60} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder={item.defaults.label} /></div>
      <div className="field"><label htmlFor={`${id}-h`}>{a('Help text in the step-by-step form (optional)', 'Texto de ayuda en el formulario paso a paso (opcional)')}</label><input id={`${id}-h`} type="text" value={f.hint} maxLength={300} onChange={(e) => setF({ ...f, hint: e.target.value })} placeholder={a('Leave empty for the built-in help text', 'Deje vacío para usar el texto de ayuda integrado')} /></div>
      <details className="es-fields" open={Boolean(item.es.text || item.es.label || item.es.hint)}>
        <summary>{a('Spanish version (optional)', 'Versión en español (opcional)')}</summary>
        <p className="hint">{a('Leave a box empty to keep the built-in Spanish.', 'Deje un cuadro vacío para conservar el español integrado.')}</p>
        <div className="field"><label htmlFor={`${id}-et`}>{a('Question in Spanish', 'Pregunta en español')}</label><input id={`${id}-et`} type="text" value={f.es.text} maxLength={200} onChange={(e) => setEs('text', e.target.value)} /></div>
        <div className="field"><label htmlFor={`${id}-el`}>{a('Short name in Spanish', 'Nombre corto en español')}</label><input id={`${id}-el`} type="text" value={f.es.label} maxLength={60} onChange={(e) => setEs('label', e.target.value)} /></div>
        <div className="field"><label htmlFor={`${id}-eh`}>{a('Help text in Spanish', 'Texto de ayuda en español')}</label><input id={`${id}-eh`} type="text" value={f.es.hint} maxLength={300} onChange={(e) => setEs('hint', e.target.value)} /></div>
      </details>
      <ErrorNote message={err} />
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>{a('Save changes', 'Guardar cambios')}</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>{a('Cancel', 'Cancelar')}</button>
        <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => go({ label: '', text: '', hint: '', es: { label: '', text: '', hint: '' } })}>{a('Use the original wording', 'Usar el texto original')}</button>
      </div>
    </form>
  );
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
      <details className="es-fields" open={Boolean(initial.es?.text)}>
        <summary>{a('Spanish version (optional)', 'Versión en español (opcional)')}</summary>
        <p className="hint">{a('What people read when they switch the site to Spanish. Leave empty to show the English.', 'Lo que ven las personas cuando cambian el sitio a español. Deje vacío para mostrar el inglés.')}</p>
        <div className="field"><label htmlFor={`${id}-et`}>{a('Question in Spanish', 'Pregunta en español')}</label><input id={`${id}-et`} type="text" value={f.es?.text || ''} maxLength={200} onChange={(e) => setF({ ...f, es: { ...f.es, text: e.target.value } })} /></div>
        <div className="field"><label htmlFor={`${id}-eh`}>{a('Help text in Spanish', 'Texto de ayuda en español')}</label><input id={`${id}-eh`} type="text" value={f.es?.hint || ''} maxLength={300} onChange={(e) => setF({ ...f, es: { ...f.es, hint: e.target.value } })} /></div>
        {f.type === 'choice' && (
          <div className="field">
            <label htmlFor={`${id}-eo`}>{a('Choices in Spanish, one per line, in the same order', 'Opciones en español, una por línea, en el mismo orden')}</label>
            <textarea id={`${id}-eo`} rows={5} value={f.es?.options || ''} onChange={(e) => setF({ ...f, es: { ...f.es, options: e.target.value } })} />
          </div>
        )}
      </details>
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
  const [editingStd, setEditingStd] = useState('');
  const [confirmStd, setConfirmStd] = useState('');
  if (loading && !data) return <Loading what={a('Loading questions', 'Cargando preguntas')} />;
  if (error) return <ErrorNote message={error} />;
  const questions = data?.questions ?? [];
  const standard = data?.standard ?? [];
  const shown = standard.filter((x) => !x.hidden).length;

  const esBody = (f) => ({ text: f.es?.text || '', hint: f.es?.hint || '', options: f.type === 'choice' ? linesOf(f.es?.options || '') : undefined });
  const toBody = (f) => ({ text: f.text, hint: f.hint, type: f.type, options: f.type === 'choice' ? linesOf(f.options) : undefined, es: esBody(f) });
  async function remove(q) {
    setErr(''); setMsg('');
    try { await api.removeQuestion(q.id); setConfirm(''); setMsg(a('Question removed. Answers people already gave to it are ignored.', 'Pregunta eliminada. Se ignoran las respuestas que ya se dieron.')); await reload(); } catch (e) { setErr(e.message); setConfirm(''); }
  }

  async function removeStd(item) {
    setErr(''); setMsg('');
    try { await api.removeStandard(item.field); setConfirmStd(''); setMsg(a('Question deleted. Nobody is asked it now. You can restore it any time.', 'Pregunta eliminada. Ya no se le hace a nadie. Puede restaurarla cuando quiera.')); await reload(); } catch (e) { setErr(e.message); setConfirmStd(''); }
  }
  async function restoreStd(item) {
    setErr(''); setMsg('');
    try { await api.restoreStandard(item.field); setMsg(a('Question restored. Everyone is asked it again.', 'Pregunta restaurada. Se le vuelve a hacer a todos.')); await reload(); } catch (e) { setErr(e.message); }
  }
  const stdText = (item) => item.text || (a.lang === 'es' ? t(`qn.q.${STD_KEY[item.field]}.t`) : item.defaults.text);

  return (
    <>
      <header className="desk-head">
        <h1 tabIndex={-1}>{a('Questions', 'Preguntas')}</h1>
        <p className="lead">{a('Add your own questions. The guide asks them in the chat after the standard ones, and they appear as more rows on the business card and in the step-by-step form. A rule can then use the answer to decide who sees it.', 'Agregue sus propias preguntas. La guía las hace en el chat después de las estándar, y aparecen como más filas en la tarjeta del negocio y en el formulario paso a paso. Una regla puede usar la respuesta para decidir quién la ve.')}</p>
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
                  initial={{ text: q.text, hint: q.hint, type: q.type, options: q.options.filter((o) => o.value !== 'unsure').map((o) => o.label).join('\n'), es: { text: q.es?.text || '', hint: q.es?.hint || '', options: (q.es?.options || []).join('\n') } }}
                  onCancel={() => setEditing('')}
                  onSave={async (f) => { await api.editQuestion(q.id, { text: f.text, hint: f.hint, options: f.type === 'choice' ? optionsFromLines(f.options, q.options.filter((o) => o.value !== 'unsure')) : undefined, es: esBody(f) }); setEditing(''); setMsg(a('Question saved.', 'Pregunta guardada.')); await reload(); }}
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

      <section aria-labelledby="sq-h" className="q-section">
        <div className="q-section-head"><h2 id="sq-h">{a('Standard questions', 'Preguntas estándar')} ({shown})</h2></div>
        <p className="hint">{a('Everyone is asked these first. Edit the wording, or delete one you do not need. A deleted question is not asked, and a rule that uses its answer shows as "may apply". Restore it any time.', 'Se hacen primero a todos. Edite el texto, o elimine una que no necesite. Una pregunta eliminada no se hace, y una regla que usa su respuesta aparece como "puede aplicar". Restáurela cuando quiera.')}</p>
        <ol className="q-list">
          {standard.map((item, i) => (
            <li key={item.field} className={`q-card${item.hidden ? ' is-deleted' : ''}`}>
              {editingStd === item.field ? (
                <StandardForm item={item} onCancel={() => setEditingStd('')} onSave={async (body) => { await api.editStandard(item.field, body); setEditingStd(''); setMsg(a('Question saved.', 'Pregunta guardada.')); await reload(); }} />
              ) : (
                <>
                  <p className="q-no">{a('Question', 'Pregunta')} {i + 1}{item.hidden ? ` · ${a('Deleted', 'Eliminada')}` : ''}{!item.hidden && (item.en.text || item.es.text) ? ` · ${a('Reworded', 'Con texto propio')}` : ''}</p>
                  <h3>{stdText(item)}</h3>
                  <div className="row">
                    {item.hidden ? (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => restoreStd(item)}>{a('Restore', 'Restaurar')}<span className="sr-only"> {stdText(item)}</span></button>
                    ) : (
                      <>
                        <button type="button" className="btn btn-sm" onClick={() => { setEditingStd(item.field); setEditing(''); setAdding(false); setMsg(''); }}>{a('Edit', 'Editar')}<span className="sr-only"> {stdText(item)}</span></button>
                        {confirmStd === item.field ? (
                          <>
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => removeStd(item)}>{a('Yes, delete it', 'Sí, eliminarla')}</button>
                            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmStd('')}>{a('Keep it', 'Conservarla')}</button>
                          </>
                        ) : (
                          <button type="button" className="btn btn-quiet btn-sm" disabled={shown <= 1} onClick={() => setConfirmStd(item.field)}>{a('Delete', 'Eliminar')}<span className="sr-only"> {stdText(item)}</span></button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
