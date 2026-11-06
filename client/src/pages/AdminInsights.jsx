import { useCallback, useState } from 'react';
import { api, useLoad } from '../api.js';
import { ErrorNote, Loading } from '../components/Parts.jsx';
import { useA } from '../adminText.js';

// Insights: counts only. Groups smaller than the minimum are hidden by the server and shown here as "fewer than 5".
const MET = { time: (v) => v < 10, finished: (v) => v >= 60, clear: (v) => v >= 80, sources: (v) => v >= 100, done: (v) => v >= 40 };

export default function AdminInsights() {
  const tr = useA();
  const [days, setDays] = useState(30);
  const fetchIt = useCallback(() => api.adminInsights(days), [days]);
  const { data, error, loading } = useLoad(fetchIt);
  if (loading && !data) return <Loading what={tr('Loading Insights', 'Cargando Insights')} />;
  if (error) return (<><h1 tabIndex={-1}>Insights</h1><ErrorNote message={error} /></>);
  const min = data.minGroup;
  const few = tr(`fewer than ${min}`, `menos de ${min}`);
  const num = (n) => (n === null || n === undefined ? few : n);
  const KPI = {
    time: { name: tr('Time from first message to a plan', 'Tiempo desde el primer mensaje hasta un plan'), note: tr('Median, in minutes. Counted in 30-second steps.', 'Mediana, en minutos. Contada en pasos de 30 segundos.') },
    finished: { name: tr('Plans finished out of plans started', 'Planes terminados de los iniciados'), note: tr('Plans shown divided by plans started.', 'Planes mostrados entre planes iniciados.') },
    clear: { name: tr('Owners who say the plan was clear', 'Propietarios que dicen que el plan fue claro'), note: tr('Yes answers out of all answers.', 'Respuestas Sí entre todas las respuestas.') },
    sources: { name: tr('Active steps with a source checked in 90 days', 'Pasos activos con fuente revisada en 90 días'), note: tr('Taken from the steps themselves.', 'Tomado de los propios pasos.') },
    done: { name: tr('Plans with at least one step done', 'Planes con al menos un paso hecho'), note: tr('Among plans saved in the last 30 days.', 'Entre los planes guardados en los últimos 30 días.') },
  };
  const Q = {
    structure: tr('Business structure', 'Estructura del negocio'), activity: tr('What the business does', 'A qué se dedica'), place: tr('City and county', 'Ciudad y condado'),
    hiring: tr('Hiring', 'Contratación'), subs: tr('Subcontractors', 'Subcontratistas'), salestax: tr('Sales tax', 'Impuesto sobre ventas'), income: tr('Income $12,000 or more', 'Ingresos de $12,000 o más'), tradename: tr('Business name', 'Nombre comercial'),
  };
  const qName = (id) => Q[id] || (id.startsWith('x:') ? tr('Added question', 'Pregunta agregada') : id);
  const REASON = {
    hard_words: tr('Hard words', 'Palabras difíciles'), too_long: tr('Too long', 'Demasiado largo'), missing_step: tr('A step is missing', 'Falta un paso'), unsure_fit: tr('Not sure it fits', 'No sé si sirve'), other: tr('Something else', 'Otra cosa'),
  };
  const bar = (n, max) => (n && max ? Math.max(4, Math.round((n / max) * 100)) : 0);
  const fMax = Math.max(data.funnel.started || 0, data.funnel.shown || 0, data.funnel.saved || 0);

  function exportCsv() {
    const rows = [['section', 'name', 'value']];
    data.kpis.forEach((k) => rows.push(['kpi', KPI[k.id].name, k.value === null ? few : `${k.value}${k.unit === '%' ? '%' : ' min'}`]));
    rows.push(['funnel', 'started', num(data.funnel.started)], ['funnel', 'plan shown', num(data.funnel.shown)], ['funnel', 'saved', num(data.funnel.saved)]);
    Object.entries(data.modes).forEach(([k, n]) => rows.push(['how they started', k, num(n)]));
    Object.entries(data.langs).forEach(([k, n]) => rows.push(['language', k, num(n)]));
    data.dropoff.forEach((q) => rows.push(['answered', qName(q.id), num(q.answered)], ['left on', qName(q.id), num(q.left)]));
    ['yes', 'partly', 'no'].forEach((k) => rows.push(['feedback', k, num(data.feedback[k])]));
    Object.entries(data.feedback.reasons).forEach(([k, n]) => rows.push(['feedback reason', k.replace('|', ' / '), num(n)]));
    data.steps.forEach((s) => rows.push(['steps marked done', s.title, s.count]));
    data.daily.forEach((d) => rows.push(['per day', `${d.day} started / shown / saved`, `${num(d.started)} / ${num(d.shown)} / ${num(d.saved)}`]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `insights-${data.days}-days.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <h1 tabIndex={-1}>Insights</h1>
      <p className="lead">{tr(`How owners use the guide. These are counts only: no names, emails, answers or typed text are stored, and any group smaller than ${min} is hidden. Targets are estimates to be validated during discovery.`, `Cómo usan la guía los propietarios. Solo son conteos: no se guardan nombres, correos, respuestas ni texto escrito, y cualquier grupo menor de ${min} se oculta. Las metas son estimaciones por validar durante el descubrimiento.`)}</p>
      <div className="ins-bar">
        <div className="ins-range" role="group" aria-label={tr('Time range', 'Periodo')}>
          {[7, 30, 90].map((d) => <button key={d} type="button" className={`btn btn-quiet btn-sm${days === d ? ' is-current' : ''}`} aria-pressed={days === d} onClick={() => setDays(d)}>{tr(`${d} days`, `${d} días`)}</button>)}
        </div>
        <button type="button" className="btn btn-quiet btn-sm" onClick={exportCsv}>{tr('Export CSV', 'Exportar CSV')}</button>
      </div>

      <ul className="ins-kpis" aria-label={tr('Key measures', 'Medidas clave')}>
        {data.kpis.map((k) => {
          const has = k.value !== null && k.value !== undefined;
          const ok = has && MET[k.id](k.value);
          return (
            <li key={k.id} className={`ins-kpi${has ? (ok ? ' is-ok' : ' is-short') : ''}`}>
              <span className="ins-kpi-name">{KPI[k.id].name}</span>
              <strong>{has ? `${k.value}${k.unit === '%' ? '%' : ''}` : '-'}{has && k.unit === 'min' ? <small> min</small> : null}</strong>
              <span className="hint">{has ? `${tr('Target', 'Meta')}: ${k.target}${k.unit === '%' ? '%' : ' min'} [est.]` : tr(`Not enough data yet (fewer than ${min})`, `Aún no hay datos suficientes (menos de ${min})`)}</span>
              <span className="hint">{KPI[k.id].note}</span>
            </li>
          );
        })}
      </ul>

      <div className="ins-grid">
        <section className="panel wide" aria-labelledby="ins-funnel">
          <h2 id="ins-funnel">{tr('From first message to saved plan', 'Del primer mensaje al plan guardado')}</h2>
          {[['started', tr('Started', 'Iniciaron')], ['shown', tr('Plan shown', 'Plan mostrado')], ['saved', tr('Saved', 'Guardaron')]].map(([k, label]) => (
            <div key={k} className="ins-row"><span>{label}</span><span className="ins-track"><span className="ins-fill" style={{ width: `${bar(data.funnel[k], fMax)}%` }} /></span><strong>{num(data.funnel[k])}</strong></div>
          ))}
          <p className="hint">{tr('Saved on this device', 'Guardado en este dispositivo')}: {num(data.saved.device)} · {tr('From an emailed link', 'Desde un enlace por correo')}: {num(data.saved.link)} · {tr('In an account', 'En una cuenta')}: {num(data.saved.account)}</p>
        </section>

        <section className="panel wide" aria-labelledby="ins-how">
          <h2 id="ins-how">{tr('Voice, typing or form, and language', 'Voz, escritura o formulario, e idioma')}</h2>
          <dl className="ins-dl">
            <div><dt>{tr('Talked', 'Hablaron')}</dt><dd>{num(data.modes.voice)}</dd></div>
            <div><dt>{tr('Typed', 'Escribieron')}</dt><dd>{num(data.modes.typing)}</dd></div>
            <div><dt>{tr('Used the form', 'Usaron el formulario')}</dt><dd>{num(data.modes.form)}</dd></div>
            <div><dt>{tr('Started from a sample', 'Empezaron con un ejemplo')}</dt><dd>{num(data.modes.sample)}</dd></div>
            <div><dt>English</dt><dd>{num(data.langs.en)}</dd></div>
            <div><dt>Español</dt><dd>{num(data.langs.es)}</dd></div>
            <div><dt>{tr('Microphone blocked', 'Micrófono bloqueado')}</dt><dd>{num(data.voiceBlocked.denied)}</dd></div>
            <div><dt>{tr('Voice not supported', 'Voz no compatible')}</dt><dd>{num(data.voiceBlocked.unsupported)}</dd></div>
          </dl>
        </section>
      </div>

      <section className="panel wide" aria-labelledby="ins-drop">
        <h2 id="ins-drop">{tr('Where people stop', 'Dónde se detienen')}</h2>
        {data.dropoff.length === 0 ? <p className="hint">{tr(`Not enough data yet. A question needs at least ${min} answers or exits to show here.`, `Aún no hay datos suficientes. Una pregunta necesita al menos ${min} respuestas o salidas para aparecer aquí.`)}</p> : (
          <div className="table-scroll">
            <table className="stack">
              <thead><tr><th scope="col">{tr('Question', 'Pregunta')}</th><th scope="col">{tr('Answered', 'Respondieron')}</th><th scope="col">{tr('Left here', 'Se fueron aquí')}</th><th scope="col">{tr('Hint', 'Pista')}</th></tr></thead>
              <tbody>
                {data.dropoff.map((q, n) => (
                  <tr key={q.id}>
                    <td>{qName(q.id)}</td>
                    <td data-label={tr('Answered', 'Respondieron')}>{num(q.answered)}</td>
                    <td data-label={tr('Left here', 'Se fueron aquí')}>{num(q.left)}</td>
                    <td data-label={tr('Hint', 'Pista')}>{n === 0 && q.left ? tr('Most people stop here. Try simpler words or a one-line explanation.', 'Aquí se detiene la mayoría. Pruebe palabras más simples o una explicación de una línea.') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="ins-grid">
        <section className="panel wide" aria-labelledby="ins-fb">
          <h2 id="ins-fb">{tr('Was this plan clear?', '¿Fue claro este plan?')}</h2>
          <dl className="ins-dl">
            <div><dt>{tr('Yes', 'Sí')}</dt><dd>{num(data.feedback.yes)}</dd></div>
            <div><dt>{tr('Partly', 'En parte')}</dt><dd>{num(data.feedback.partly)}</dd></div>
            <div><dt>{tr('No', 'No')}</dt><dd>{num(data.feedback.no)}</dd></div>
          </dl>
          <h3>{tr('Reasons given', 'Motivos indicados')}</h3>
          <ul className="ins-reasons">
            {Object.entries(REASON).map(([r, label]) => (
              <li key={r}><span>{label}</span><span className="hint">{tr('Partly', 'En parte')}: {num(data.feedback.reasons[`partly|${r}`])} · {tr('No', 'No')}: {num(data.feedback.reasons[`no|${r}`])}</span></li>
            ))}
          </ul>
        </section>
        <section className="panel wide" aria-labelledby="ins-steps">
          <h2 id="ins-steps">{tr('Steps marked done', 'Pasos marcados como hechos')}</h2>
          {data.steps.length === 0 ? <p className="hint">{tr(`Not enough data yet. A step needs at least ${min} marks to show here.`, `Aún no hay datos suficientes. Un paso necesita al menos ${min} marcas para aparecer aquí.`)}</p> : (
            <ul className="ins-reasons">{data.steps.map((s) => <li key={s.id}><span>{s.title}</span><strong>{s.count}</strong></li>)}</ul>
          )}
        </section>
      </div>

      <details className="fold ins-how-collected">
        <summary><span className="fold-title">{tr('How these numbers are collected', 'Cómo se reúnen estos números')}</span></summary>
        <ul>
          <li>{tr('Only counts per day. No names, emails, addresses, typed text or IP addresses are stored with any event.', 'Solo conteos por día. Con ningún evento se guardan nombres, correos, direcciones, texto escrito ni direcciones IP.')}</li>
          <li>{tr('Admin and test accounts are not counted.', 'Las cuentas de administración y de prueba no se cuentan.')}</li>
          <li>{tr(`Any group smaller than ${min} is hidden.`, `Cualquier grupo menor de ${min} se oculta.`)}</li>
          <li>{tr('Counts older than 90 days [est.] are deleted.', 'Los conteos de más de 90 días [est.] se borran.')}</li>
          <li>{tr('Time to a plan is measured in the visitor’s own browser tab and sent only as a number of seconds, in 30-second steps.', 'El tiempo hasta un plan se mide en la pestaña del propio visitante y se envía solo como un número de segundos, en pasos de 30 segundos.')}</li>
        </ul>
      </details>
    </>
  );
}
