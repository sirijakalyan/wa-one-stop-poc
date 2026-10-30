import { useCallback, useState } from 'react';
import { api, useLoad } from '../api.js';
import { ErrorNote } from './Parts.jsx';
import { useA } from '../adminText.js';

// Evidence behind "Pending verification". Recording a review or a county page does not change
// any rule's status or approval. Names only for reviewers. No personal data in notes.
export default function EvidencePanel({ rules }) {
  const a = useA();
  const [ruleId, setRuleId] = useState(rules[0]?.id || '');
  const fetchReviews = useCallback(() => api.sourceReviews(), []);
  const fetchCounties = useCallback(() => api.countySources(), []);
  const reviews = useLoad(fetchReviews);
  const counties = useLoad(fetchCounties);
  const rule = rules.find((r) => r.id === ruleId);

  const [review, setReview] = useState({ sourceUrl: '', reviewedBy: '', result: 'pending', notes: '' });
  const [county, setCounty] = useState({ county: '', officialUrl: '', reviewedBy: '', status: 'pending' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function run(fn, success, after) {
    setErr('');
    setMsg('');
    try {
      await fn();
      setMsg(success);
      await after();
    } catch (e) {
      setErr(e.message);
    }
  }
  const titleOf = (id) => rules.find((r) => r.id === id)?.title || id;
  const countyName = (c) => `${String(c).replace(/\b[a-z]/g, (m) => m.toUpperCase())} County`;
  const day = (iso) => String(iso || '').slice(0, 10);
  const recent = (reviews.data?.reviews || []).slice(0, 8);

  return (
    <section aria-labelledby="evidence-h">
      <h2 id="evidence-h">{a('Evidence for Pending verification', 'Evidencia para Verificación pendiente')}</h2>
      <p className="note">
        {a('Recording a review or a county page here does not change a step\'s status. To mark a step as checked, open it in the editor above and click Mark as checked. Do not put personal details in notes.', 'Registrar aquí una revisión o una página de condado no cambia el estado de un paso. Para marcar un paso como revisado, ábralo en el editor de arriba y haga clic en Marcar como revisado. No ponga datos personales en las notas.')}
      </p>
      <ErrorNote message={err} />
      {msg && <p className="ok" role="status">{msg}</p>}

      <div className="two-col">
        <form className="panel" aria-labelledby="sr-h" onSubmit={(e) => {
          e.preventDefault();
          run(() => api.addSourceReview({ ruleId, ...review, sourceUrl: review.sourceUrl || rule?.source?.url || '' }), a('Source review recorded.', 'Revisión de fuente registrada.'), async () => {
            setReview({ sourceUrl: '', reviewedBy: '', result: 'pending', notes: '' });
            await reviews.reload();
          });
        }}>
          <h3 id="sr-h">{a('Record a source review', 'Registrar una revisión de fuente')}</h3>
          <div className="field">
            <label htmlFor="sr-rule">{a('Step', 'Paso')}</label>
            <select id="sr-rule" value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
              {rules.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sr-url">{a('Official page reviewed (https)', 'Página oficial revisada (https)')}</label>
            <input id="sr-url" type="text" value={review.sourceUrl} placeholder={rule?.source?.url || ''} onChange={(e) => setReview({ ...review, sourceUrl: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="sr-by">{a('Who reviewed this page', 'Quién revisó esta página')}</label>
            <input id="sr-by" type="text" maxLength={80} value={review.reviewedBy} onChange={(e) => setReview({ ...review, reviewedBy: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="sr-result">{a('Result', 'Resultado')}</label>
            <select id="sr-result" value={review.result} onChange={(e) => setReview({ ...review, result: e.target.value })}>
              <option value="pending">{a('Pending: page does not yet support the step', 'Pendiente: la página aún no respalda el paso')}</option>
              <option value="checked">{a('Checked: page supports the step', 'Revisado: la página respalda el paso')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="sr-notes">{a('Notes', 'Notas')}</label>
            <textarea id="sr-notes" maxLength={1000} value={review.notes} onChange={(e) => setReview({ ...review, notes: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">{a('Record review', 'Registrar revisión')}</button>
        </form>

        <form className="panel" aria-labelledby="cs-h" onSubmit={(e) => {
          e.preventDefault();
          run(() => api.saveCountySource(county.county, { officialUrl: county.officialUrl, reviewedBy: county.reviewedBy, status: county.status }), a('County page saved.', 'Página del condado guardada.'), async () => {
            setCounty({ county: '', officialUrl: '', reviewedBy: '', status: 'pending' });
            await counties.reload();
          });
        }}>
          <h3 id="cs-h">{a('Save a county health page', 'Guardar una página de salud del condado')}</h3>
          <div className="field">
            <label htmlFor="cs-county">{a('County', 'Condado')}</label>
            <input id="cs-county" type="text" maxLength={40} placeholder={a('For example King', 'Por ejemplo King')} value={county.county} onChange={(e) => setCounty({ ...county, county: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cs-url">{a('Official county page (https)', 'Página oficial del condado (https)')}</label>
            <input id="cs-url" type="text" value={county.officialUrl} onChange={(e) => setCounty({ ...county, officialUrl: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cs-by">{a('Who reviewed the county page', 'Quién revisó la página del condado')}</label>
            <input id="cs-by" type="text" maxLength={80} value={county.reviewedBy} onChange={(e) => setCounty({ ...county, reviewedBy: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cs-status">{a('Status', 'Estado')}</label>
            <select id="cs-status" value={county.status} onChange={(e) => setCounty({ ...county, status: e.target.value })}>
              <option value="pending">{a('Pending: page not yet reviewed', 'Pendiente: página aún sin revisar')}</option>
              <option value="verified">{a('Verified: reviewed and correct', 'Verificada: revisada y correcta')}</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-sm">{a('Save county page', 'Guardar página del condado')}</button>
          <p className="hint">{a('A county link may be shown only after its page is Verified. This screen only records it. The checklist does not show county links yet.', 'Un enlace de condado solo puede mostrarse después de que su página esté Verificada. Esta pantalla solo lo registra. La lista aún no muestra enlaces de condado.')}</p>
        </form>
      </div>

      <h3>{a('Recent source reviews', 'Revisiones de fuentes recientes')} ({reviews.data?.reviews?.length ?? 0})</h3>
      {recent.length === 0 ? <p className="hint">{a('No reviews recorded yet.', 'Aún no hay revisiones registradas.')}</p> : (
        <div className="table-scroll">
          <table className="stack">
            <thead><tr><th scope="col">{a('Step', 'Paso')}</th><th scope="col">{a('Result', 'Resultado')}</th><th scope="col">{a('Reviewer', 'Revisor')}</th><th scope="col">{a('Date', 'Fecha')}</th><th scope="col">{a('Notes', 'Notas')}</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>{titleOf(r.ruleId)}</td>
                  <td data-label={a('Result', 'Resultado')}><span className={`pill ${r.result === 'checked' ? 'applies' : 'pending'}`}>{r.result === 'checked' ? a('Checked', 'Revisada') : a('Pending', 'Pendiente')}</span></td>
                  <td data-label={a('Reviewer', 'Revisor')}>{r.reviewedBy}</td>
                  <td data-label={a('Date', 'Fecha')}>{day(r.reviewedAt)}</td>
                  <td data-label={a('Notes', 'Notas')}>{r.notes || a('None', 'Ninguna')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>{a('County health pages', 'Páginas de salud de condados')} ({counties.data?.counties?.length ?? 0})</h3>
      {(counties.data?.counties || []).length === 0 ? <p className="hint">{a('No county pages recorded yet.', 'Aún no hay páginas de condados registradas.')}</p> : (
        <div className="table-scroll">
          <table className="stack">
            <thead><tr><th scope="col">{a('County', 'Condado')}</th><th scope="col">{a('Status', 'Estado')}</th><th scope="col">{a('Reviewer', 'Revisor')}</th><th scope="col">{a('Date', 'Fecha')}</th><th scope="col">{a('Official page', 'Página oficial')}</th></tr></thead>
            <tbody>
              {counties.data.counties.map((c) => (
                <tr key={c.county}>
                  <td>{countyName(c.county)}</td>
                  <td data-label={a('Status', 'Estado')}><span className={`pill ${c.status === 'verified' ? 'applies' : 'pending'}`}>{c.status === 'verified' ? a('Verified', 'Verificada') : a('Pending', 'Pendiente')}</span></td>
                  <td data-label={a('Reviewer', 'Revisor')}>{c.reviewedBy}</td>
                  <td data-label={a('Date', 'Fecha')}>{day(c.reviewedAt)}</td>
                  <td data-label={a('Official page', 'Página oficial')}><span className="mono-small">{c.officialUrl}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
