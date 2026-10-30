import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';
import { api, getAdminKey, setAdminKey, useLoad } from '../api.js';
import { ErrorNote, Loading, humanInput } from '../components/Parts.jsx';
import EvidencePanel from '../components/EvidencePanel.jsx';
import ExternalLink from '../components/ExternalLink.jsx';
import AdminUsers from './AdminUsers.jsx';
import AdminQuestions from './AdminQuestions.jsx';
import AddRuleForm from '../components/AddRuleForm.jsx';
import AppliesPicker, { pickerFrom } from '../components/AppliesPicker.jsx';
import SpanishRuleFields from '../components/SpanishRuleFields.jsx';
import Sources from './Sources.jsx';
import { useA } from '../adminText.js';

const fieldsFor = (a) => [
  { key: 'title', label: a('Requirement name', 'Nombre del requisito'), type: 'text' },
  { key: 'detail', label: a('Plain-language detail', 'Detalle en lenguaje sencillo'), type: 'area' },
  { key: 'source.label', label: a('Source name', 'Nombre de la fuente'), type: 'text' },
  { key: 'source.url', label: a('Source link (https)', 'Enlace de la fuente (https)'), type: 'text' },
  { key: 'apply.label', label: a('Apply button text', 'Texto del botón de solicitud'), type: 'text' },
  { key: 'apply.url', label: a('Apply link (https)', 'Enlace de solicitud (https)'), type: 'text' },
  { key: 'verification.status', label: a('Verification status', 'Estado de verificación'), type: 'select' },
  { key: 'verification.note', label: a('Verification note', 'Nota de verificación'), type: 'text' },
];
const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o) ?? '';
const STALE_DAYS = 365;

function staleness(rule, a) {
  if (!rule.lastVerified) return a('Not yet verified', 'Aún sin verificar');
  const days = (Date.now() - new Date(rule.lastVerified).getTime()) / 86400000;
  return days > STALE_DAYS ? a('Stale: over 12 months', 'Vencida: más de 12 meses') : a('Current', 'Vigente');
}

// One verification state per rule, shown as a lamp on its tile.
function statusOf(r, a) {
  if (r.verification.status !== 'checked' || !r.lastVerified) return { key: 'needs', label: a('Needs check', 'Falta revisar') };
  if (staleness(r, a) !== a('Current', 'Vigente')) return { key: 'stale', label: a('Stale', 'Vencida') };
  return { key: 'ok', label: a('Checked', 'Revisada') };
}
const shortDay = (iso, a) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(a.locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');

function AdminPanel({ signedIn = false }) {
  const a = useA();
  const FIELDS = fieldsFor(a);
  const fetchRules = useCallback(() => api.rules(), []);
  const fetchChanges = useCallback(() => api.changes(), []);
  const rulesLoad = useLoad(fetchRules);
  // Spanish names for the built-in rules, for reading only. The edit form always works on the published English text.
  const fetchLoc = useCallback(() => (a.lang === 'es' ? api.rules('es') : Promise.resolve(null)), [a.lang]);
  const locLoad = useLoad(fetchLoc);
  const locById = Object.fromEntries((locLoad.data?.rules ?? []).map((r) => [r.id, r]));
  const nameOf = (r) => locById[r.id]?.title || r.title;
  const agencyOf = (r) => locById[r.id]?.agency || r.agency;
  const reviewerName = (n) => (n === 'admin key' ? a('admin key', 'clave de administración') : n);
  const changesLoad = useLoad(fetchChanges);
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState({});
  const [reviewer, setReviewer] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [audience, setAudience] = useState({ mode: 'always', field: '', value: '' });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [esForm, setEsForm] = useState({ title: '', agency: '', detail: '', sourceLabel: '', applyLabel: '' });
  const fieldsLoad = useLoad(useCallback(() => api.ruleFields().catch(() => ({ fields: [] })), []));
  const fields = fieldsLoad.data?.fields ?? [];

  const rules = rulesLoad.data?.rules ?? [];
  const rule = rules.find((r) => r.id === selected);

  // Fill the form with the published values, plus any saved draft.
  useEffect(() => {
    if (!rule) return;
    const f = {};
    FIELDS.forEach(({ key }) => { f[key] = rule.draft && key in rule.draft ? rule.draft[key] : getPath(rule, key); });
    setForm(f);
    setAudience(pickerFrom(rule.applies));
    setEsForm({ title: '', agency: '', detail: '', sourceLabel: '', applyLabel: '', ...(rule.es || {}) });
    setConfirmRemove(false);
  }, [rule]);

  async function run(fn, success) {
    setErr('');
    setMsg('');
    try {
      const result = await fn();
      await rulesLoad.reload();
      await changesLoad.reload();
      await locLoad.reload();
      if (success) setMsg(typeof success === 'function' ? success(result) : success);
      return result;
    } catch (e) {
      setErr(e.message);
      return null;
    }
  }

  if (rulesLoad.loading && !rulesLoad.data) return <Loading what={a('Loading rules', 'Cargando reglas')} />;
  if (rulesLoad.error) return <ErrorNote message={rulesLoad.error} />;

  const checkedCount = rules.filter((r) => statusOf(r, a).key === 'ok').length;
  const needsCount = rules.length - checkedCount;
  const draftCount = rules.filter((r) => r.draft).length;
  const dim = (r) => (filter === 'needs' ? statusOf(r, a).key === 'ok' : filter === 'drafts' ? !r.draft : false);
  const ruleChanges = (changesLoad.data?.changes ?? []).filter((c) => c.ruleId === selected);

  return (
    <>
      <header className="desk-head">
        <h1 tabIndex={-1}>{a('Rule desk', 'Mesa de reglas')}</h1>
        <p className="lead">
          {needsCount === 0 ? a('Every rule has been checked against its official page.', 'Todas las reglas se revisaron contra su página oficial.') : a(`${needsCount} of ${rules.length} rules need a check before you can trust them.`, `${needsCount} de ${rules.length} reglas necesitan una revisión antes de confiar en ellas.`)}{' '}
          {a('Pick a rule to edit it. Nothing goes live until a second person approves it.', 'Elija una regla para editarla. Nada se publica hasta que una segunda persona lo apruebe.')}
        </p>
        <p className="desk-add">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setAdding(true); setSelected(''); setMsg(''); setErr(''); setTimeout(() => document.getElementById('add-rule-h')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); }}>{a('Add a rule', 'Agregar una regla')}</button>
        </p>
        <p className="desk-note">
          {signedIn
            ? a('Unlocked for this browser. Published changes are live for every visitor.', 'Desbloqueado en este navegador. Los cambios publicados se ven para todos los visitantes.')
            : a('No admin key is set on this server, so anyone can edit. Use this only for local development.', 'Este servidor no tiene clave de administración, así que cualquiera puede editar. Úselo solo para desarrollo local.')}
        </p>
      </header>

      <section className="board" aria-labelledby="board-h">
        <div className="board-top">
          <h2 id="board-h" className="board-title"><strong>{checkedCount}</strong> {a('of', 'de')} {rules.length} {a('rules checked', 'reglas revisadas')}</h2>
          <div className="board-filters" role="group" aria-label={a('Show', 'Mostrar')}>
            {[['all', `${a('All', 'Todas')} ${rules.length}`], ['needs', `${a('Needs check', 'Falta revisar')} ${needsCount}`], ['drafts', `${a('Has a draft', 'Con borrador')} ${draftCount}`]].map(([k, label]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
        </div>
        <ul className="board-grid">
          {rules.map((r, i) => {
            const st = statusOf(r, a);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className={`tile tile--${st.key}${r.id === selected ? ' is-on' : ''}${dim(r) ? ' is-dim' : ''}`}
                  aria-pressed={r.id === selected}
                  aria-label={`${nameOf(r)}. ${st.label}${r.draft ? a('. Has a draft', '. Tiene un borrador') : ''}`}
                  onClick={() => { setSelected(r.id); setMsg(''); setErr(''); setTimeout(() => document.getElementById('desk-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }}
                >
                  <span className="tile-top">
                    <span className="tile-no">{String(i + 1).padStart(2, '0')}</span>
                    <span className="lamp" aria-hidden="true" />
                    <span className="tile-state">{st.label}</span>
                    {r.draft && <span className="tile-draft">{a('Draft', 'Borrador')}</span>}
                    {r.custom && <span className="tile-draft tile-added">{a('Added', 'Agregada')}</span>}
                  </span>
                  <span className="tile-title">{nameOf(r)}</span>
                  <span className="tile-foot">{agencyOf(r)} · {r.lastVerified ? a(`checked ${shortDay(r.lastVerified, a)}`, `revisada ${shortDay(r.lastVerified, a)}`) : a('never checked', 'nunca revisada')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <ErrorNote message={err} />
      {msg && <p className="ok" role="status">{msg}</p>}

      {adding && (
        <AddRuleForm
          phases={locLoad.data?.phases ?? rulesLoad.data?.phases ?? {}}
          fields={fields}
          onCancel={() => setAdding(false)}
          onAdded={async (res) => {
            setAdding(false);
            await rulesLoad.reload();
            await changesLoad.reload();
            setSelected(res.rule.id);
            setMsg(a(`Rule added and live. Simulated notices queued: ${res.queuedNotifications}. It shows "Pending verification" until a second person checks it.`, `Regla agregada y publicada. Avisos simulados en cola: ${res.queuedNotifications}. Muestra "Verificación pendiente" hasta que una segunda persona la revise.`));
          }}
        />
      )}

      <div id="desk-editor" className="desk-editor-anchor">
        {!rule && !adding && <p className="desk-empty">{a('Pick a rule on the board to read it, edit it and send it for a second check.', 'Elija una regla del tablero para leerla, editarla y enviarla a una segunda revisión.')}</p>}
        {rule && (
          <div className="desk-editor">
            <section className="panel editor" aria-labelledby="editor-h">
              <h2 id="editor-h">{a('Edit:', 'Editar:')} {nameOf(rule)}</h2>
              <p className="hint">{rule.custom ? a('You added this rule. Change who sees it in the panel on the right.', 'Usted agregó esta regla. Cambie quién la ve en el panel de la derecha.') : a('The condition that decides who sees this built-in rule is fixed in the rules file.', 'La condición que decide quién ve esta regla integrada está fija en el archivo de reglas.')}</p>
              <form onSubmit={(e) => e.preventDefault()}>
                {FIELDS.map((f) => (
                  <div className="field" key={f.key}>
                    <label htmlFor={`f-${f.key}`}>{f.label}</label>
                    {f.type === 'area' && (
                      <textarea id={`f-${f.key}`} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                    )}
                    {f.type === 'text' && (
                      <input type="text" id={`f-${f.key}`} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                    )}
                    {f.type === 'select' && (
                      <select id={`f-${f.key}`} value={form[f.key] ?? 'pending'} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                        <option value="checked">{a('Checked against the official page', 'Revisada contra la página oficial')}</option>
                        <option value="pending">{a('Pending a second-person check', 'Pendiente de revisión por una segunda persona')}</option>
                      </select>
                    )}
                  </div>
                ))}
                <div className="row">
                  <button type="button" className="btn btn-sm" onClick={() => run(() => api.saveDraft(rule.id, form), a('Draft saved. Nothing is live until it is approved.', 'Borrador guardado. Nada se publica hasta que se apruebe.'))}>{a('Save draft', 'Guardar borrador')}</button>
                  {rule.draft && (
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => run(() => api.discardDraft(rule.id), a('Draft discarded.', 'Borrador descartado.'))}>{a('Discard draft', 'Descartar borrador')}</button>
                  )}
                </div>
              </form>

              {rule.draft && (
                <>
                  <h3>{a('Side-by-side change', 'Cambio lado a lado')}</h3>
                  <div className="table-scroll">
                    <table>
                      <thead><tr><th scope="col">{a('Field', 'Campo')}</th><th scope="col">{a('Published now', 'Publicado ahora')}</th><th scope="col">{a('Draft', 'Borrador')}</th></tr></thead>
                      <tbody>
                        {Object.entries(rule.draft).map(([k, v]) => (
                          <tr key={k}>
                            <td>{FIELDS.find((f) => f.key === k)?.label || k}</td>
                            <td className="from">{getPath(rule, k) || a('Empty', 'Vacío')}</td>
                            <td className="to">{v || a('Empty', 'Vacío')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="field">
                    <label htmlFor="reviewer">{a('Reviewer name (required to approve)', 'Nombre del revisor (obligatorio para aprobar)')}</label>
                    <input type="text" id="reviewer" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder={a('Name of the person approving', 'Nombre de la persona que aprueba')} maxLength={80} />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => run(
                      () => api.publish(rule.id, reviewer),
                      (r) => a(`Published as version ${r.rule.version}. Simulated notices queued: ${r.queuedNotifications}.`, `Publicada como versión ${r.rule.version}. Avisos simulados en cola: ${r.queuedNotifications}.`),
                    )}
                  >
                    {a('Approve and publish', 'Aprobar y publicar')}
                  </button>
                </>
              )}
            </section>

            <aside className="desk-side" aria-label={a('This rule today', 'Esta regla hoy')}>
              <h2>{a('Live now', 'En vivo ahora')}</h2>
              <dl className="desk-facts">
                <div><dt>{a('Status', 'Estado')}</dt><dd>{statusOf(rule, a).label}</dd></div>
                <div><dt>{a('Version', 'Versión')}</dt><dd>{rule.version}</dd></div>
                <div><dt>{a('Last verified', 'Última verificación')}</dt><dd>{rule.lastVerified || a('Never', 'Nunca')} <small>{staleness(rule, a)}</small></dd></div>
                <div><dt>{a('Owner', 'Responsable')}</dt><dd>{humanInput(rule.owner, a.lang)}</dd></div>
                <div><dt>{a('Reviewer', 'Revisor')}</dt><dd>{rule.reviewer || a('none yet', 'ninguno aún')}</dd></div>
                <div><dt>{a('Agency', 'Agencia')}</dt><dd>{agencyOf(rule)}</dd></div>
                <div><dt>{a('Draft', 'Borrador')}</dt><dd>{rule.draft ? a('Yes, waiting for approval', 'Sí, esperando aprobación') : 'No'}</dd></div>
              </dl>
              {rule.source?.url && <p><ExternalLink className="btn btn-quiet btn-sm" href={rule.source.url}>{a('Open the source page', 'Abrir la página de la fuente')}</ExternalLink></p>}
              {rule.custom ? (
                <div className="desk-audience">
                  <SpanishRuleFields idPrefix="ed-es" value={esForm} onChange={setEsForm} />
                  <div className="row">
                    <button type="button" className="btn btn-sm" onClick={() => run(() => api.setRuleEs(rule.id, esForm), a('Spanish text saved.', 'Texto en español guardado.'))}>{a('Save Spanish text', 'Guardar texto en español')}</button>
                  </div>
                  <AppliesPicker idPrefix="ed" fields={fields} value={audience} onChange={setAudience} />
                  <div className="row">
                    <button type="button" className="btn btn-sm" onClick={() => run(() => api.setApplies(rule.id, audience), (r) => a(`Saved. Simulated notices queued: ${r.queuedNotifications}.`, `Guardado. Avisos simulados en cola: ${r.queuedNotifications}.`))}>{a('Save who sees it', 'Guardar quién la ve')}</button>
                    {confirmRemove ? (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" onClick={async () => { const ok = await run(() => api.removeRule(rule.id), a('Rule removed.', 'Regla eliminada.')); if (ok) setSelected(''); }}>{a('Yes, remove this rule', 'Sí, eliminar esta regla')}</button>
                        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmRemove(false)}>{a('Keep it', 'Conservarla')}</button>
                      </>
                    ) : <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmRemove(true)}>{a('Remove this rule', 'Eliminar esta regla')}</button>}
                  </div>
                </div>
              ) : <p className="hint">{a('This is a built-in rule. Who sees it is fixed in the rules file. You can edit its text and links.', 'Esta es una regla integrada. Quién la ve está fijo en el archivo de reglas. Puede editar su texto y sus enlaces.')}</p>}
              <h3>{a('History of this rule', 'Historial de esta regla')}</h3>
              {ruleChanges.length === 0 ? <p className="hint">{a('No published changes yet.', 'Aún no hay cambios publicados.')}</p> : (
                <ul className="desk-history">
                  {ruleChanges.map((c) => (
                    <li key={c.id}><strong>{a('Version', 'Versión')} {c.version}</strong> {a('approved by', 'aprobada por')} {reviewerName(c.reviewer)}, {new Date(c.at).toLocaleDateString(a.locale)}. {a('Changed:', 'Cambió:')} {c.fields.map((f) => f.field).join(', ')}.</li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        )}
      </div>

      <div className="desk-more">
        <details className="who-edits" data-testid="who-can-edit">
          <summary>{a('How editing works and who can edit', 'Cómo funciona la edición y quién puede editar')}</summary>
          <ul>
            <li>
              <strong>{a('Admin accounts.', 'Cuentas de administración.')}</strong>{' '}
              {a('A person whose account an admin made an admin signs in with their own email and password, and can edit rules, record source reviews and publish. Make or remove admins in the People tab.',
                'Una persona a quien un administrador le dio ese rol inicia sesión con su propio correo y contraseña, y puede editar reglas, registrar revisiones de fuentes y publicar. Agregue o quite administradores en la pestaña Personas.')}
            </li>
            <li>
              <strong>{a('The admin key.', 'La clave de administración.')}</strong>{' '}
              {a('The shared secret set on the server (ADMIN_KEY) also unlocks this page for anyone who has it, but the app cannot tell who is using the key. A production server with no key keeps this page locked.',
                'El secreto compartido del servidor (ADMIN_KEY) también desbloquea esta página para quien lo tenga, pero la aplicación no puede saber quién usa la clave. Un servidor de producción sin clave mantiene esta página bloqueada.')}
            </li>
            <li>
              <strong>{a('The reviewer.', 'El revisor.')}</strong>{' '}
              {a('The reviewer compares a draft with the official agency page and approves it. They type their own name when they publish. The app saves that name and the date but cannot check that it is really them. The reviewer should be a different person from whoever wrote the draft.',
                'El revisor compara un borrador con la página oficial de la agencia y lo aprueba. Escribe su propio nombre al publicar. La aplicación guarda ese nombre y la fecha, pero no puede comprobar que sea esa persona. El revisor debe ser alguien distinto de quien escribió el borrador.')}
            </li>
            <li>
              <strong>{a('Draft and publish.', 'Borrador y publicación.')}</strong>{' '}
              {a('Save draft stores your edits only. Approve and publish makes the change live for every visitor, adds one to the version number, records the reviewer and the date, and queues a simulated notice for checklists that include the rule. Publishing cannot change who a rule applies to.',
                'Guardar borrador solo guarda sus cambios. Aprobar y publicar hace el cambio visible para todos los visitantes, suma uno al número de versión, registra al revisor y la fecha, y pone en cola un aviso simulado para las listas que incluyen la regla. Publicar no puede cambiar a quién se aplica una regla.')}
            </li>
            <li>
              <strong>{a('Verification status.', 'Estado de verificación.')}</strong>{' '}
              {a('Set "Checked" only after a person has read the official page and compared it with the rule. Recording a source review does not change a rule\'s status by itself. Each rule has an owner field that reads "NEEDS HUMAN INPUT" until your team names a person.',
                'Marque "Revisada" solo después de que una persona haya leído la página oficial y la haya comparado con la regla. Registrar una revisión de fuente no cambia por sí solo el estado de una regla. Cada regla tiene un campo de responsable que dice "NEEDS HUMAN INPUT" hasta que su equipo nombre a una persona.')}
            </li>
          </ul>
        </details>

        {rules.length > 0 && (
          <details>
            <summary>{a('Evidence: source reviews and county pages', 'Evidencia: revisiones de fuentes y páginas de condados')}</summary>
            <EvidencePanel rules={rules.map((r) => ({ ...r, title: nameOf(r) }))} />
          </details>
        )}

        <details>
          <summary>{a('Official sources and how this works', 'Fuentes oficiales y cómo funciona')}</summary>
          <Sources embedded />
        </details>

        <details>
          <summary>{a('Change history', 'Historial de cambios')} ({changesLoad.data?.changes?.length ?? 0})</summary>
          {(changesLoad.data?.changes ?? []).length === 0 && <p className="hint">{a('No published changes yet.', 'Aún no hay cambios publicados.')}</p>}
          <ul className="notes">
            {(changesLoad.data?.changes ?? []).map((c) => (
              <li key={c.id} className="note-item">
                <h3>{locById[c.ruleId]?.title || c.ruleTitle} ({a('version', 'versión')} {c.version})</h3>
                <p>{a('Approved by', 'Aprobada por')} {reviewerName(c.reviewer)} {a('on', 'el')} {new Date(c.at).toLocaleString(a.locale)}. {a('Fields changed:', 'Campos cambiados:')} {c.fields.map((f) => f.field).join(', ')}.</p>
              </li>
            ))}
          </ul>
        </details>

        <details>
          <summary>{a('Reset sample data', 'Restablecer datos de muestra')}</summary>
          {!confirmReset ? (
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmReset(true)}>{a('Reset sample data', 'Restablecer datos de muestra')}</button>
          ) : (
            <div className="row">
              <p className="hint">{a('This restores the original rules and clears your checklist and notifications.', 'Esto restaura las reglas originales y borra su lista y sus notificaciones.')}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { setConfirmReset(false); setSelected(''); run(() => api.resetDemo(), a('Sample data reset.', 'Datos de muestra restablecidos.')); }}>{a('Yes, reset', 'Sí, restablecer')}</button>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmReset(false)}>{a('Cancel', 'Cancelar')}</button>
            </div>
          )}
        </details>
      </div>
    </>
  );
}

// Shared admin key gate. The key is typed here, kept for this browser tab only, and sent as a header.
export default function Admin() {
  const a = useA();
  const fetchStatus = useCallback(() => api.adminStatus(), []);
  const { data, error, loading, reload } = useLoad(fetchStatus);
  const [key, setKey] = useState('');
  const [keyError, setKeyError] = useState('');
  const { user } = useApp();
  const [params, setParams] = useSearchParams();

  if (loading && !data) return <Loading what={a('Checking admin access', 'Comprobando el acceso de administración')} />;
  if (error) return <ErrorNote message={error} />;
  // A signed-in person who is not an admin gets a plain "not for you" page, with no key box to try.
  if (user && user.role !== 'admin' && !data?.authorized) {
    return (
      <div className="panel gate">
        <h1 tabIndex={-1}>{a('Admins only', 'Solo administradores')}</h1>
        <p className="lead">{a('This area is only for admins. Your account can use Home and My business.', 'Esta área es solo para administradores. Su cuenta puede usar Inicio y Mi negocio.')}</p>
        <p><Link className="btn btn-primary btn-sm" to="/home">{a('Back to Home', 'Volver al inicio')}</Link></p>
      </div>
    );
  }
  if (data?.required && !data.authorized) {
    async function submit(e) {
      e.preventDefault();
      setKeyError('');
      setAdminKey(key.trim());
      const next = await api.adminStatus().catch(() => null);
      if (next?.authorized) {
        setKey('');
        await reload();
      } else {
        setAdminKey('');
        setKeyError(a('That key did not match. Check it and try again.', 'Esa clave no coincide. Revísela e inténtelo de nuevo.'));
      }
    }
    return (
      <div className="panel gate">
        <h1 tabIndex={-1}>{a('Rule desk', 'Mesa de reglas')}</h1>
        {data.keyConfigured ? (
          <>
            <p className="lead">{a('This area is for content owners. Enter the admin key to edit rules.', 'Esta área es para los responsables del contenido. Escriba la clave de administración para editar reglas.')}</p>
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="admin-key">{a('Admin key', 'Clave de administración')}</label>
                <input id="admin-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={!key.trim()}>{a('Unlock admin', 'Desbloquear administración')}</button>
              <ErrorNote message={keyError} />
            </form>
            <p className="hint">{a('Or', 'O')} <Link to="/login" state={{ from: '/admin' }}>{a('sign in with an admin account', 'inicie sesión con una cuenta de administración')}</Link>. {a('Who can edit: people with the admin key and people whose account an admin made an admin.', 'Quién puede editar: quienes tienen la clave de administración y quienes tienen una cuenta que un administrador marcó como administradora.')}</p>
          </>
        ) : (
          <>
          <p className="lead">{a('Admin is locked. Sign in with an admin account, or the server owner can set an ADMIN_KEY.', 'La administración está bloqueada. Inicie sesión con una cuenta de administración, o el dueño del servidor puede definir un ADMIN_KEY.')}</p>
          {!user && <p><Link className="btn btn-primary btn-sm" to="/login" state={{ from: '/admin' }}>{a('Sign in', 'Iniciar sesión')}</Link></p>}
          </>
        )}
      </div>
    );
  }
  const tabs = [['rules', a('Rules', 'Reglas')], ['questions', a('Questions', 'Preguntas')], ['people', a('People', 'Personas')]];
  const asked = params.get('tab');
  const wanted = asked === 'users' ? 'people' : asked === 'sources' ? 'rules' : asked;
  const tab = tabs.some(([k]) => k === wanted) ? wanted : (data?.strict ? 'people' : 'rules');
  return (
    <>
      <div className="admin-tabs desk-switch" role="tablist" aria-label={a('Admin sections', 'Secciones de administración')}>
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" id={`atab-${k}`} aria-selected={tab === k} aria-controls="admin-body" onClick={() => setParams({ tab: k })}>{label}</button>
        ))}
      </div>
      <div id="admin-body" role="tabpanel" aria-labelledby={`atab-${tab}`}>
        {tab === 'people' && (data?.strict ? <AdminUsers /> : (
          <>
            <h1 tabIndex={-1}>{a('People', 'Personas')}</h1>
            <p className="lead">{a('Sign in with an admin account, or enter the admin key, to see who has signed up and what they did.', 'Inicie sesión con una cuenta de administración, o escriba la clave, para ver quién se registró y qué hizo.')}</p>
            <p><Link className="btn btn-primary btn-sm" to="/login" state={{ from: '/admin' }}>{a('Sign in', 'Iniciar sesión')}</Link></p>
          </>
        ))}
        {tab === 'questions' && <AdminQuestions />}
        {tab === 'rules' && <AdminPanel signedIn={Boolean(data?.required && (getAdminKey() || data?.accountAdmin))} />}
      </div>
    </>
  );
}
