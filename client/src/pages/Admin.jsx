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
  if (r.disabled) return { key: 'off', label: a('Disabled', 'Desactivada') };
  if (r.verification.status !== 'checked' || !r.lastVerified) return { key: 'needs', label: a('Needs check', 'Falta revisar') };
  if (staleness(r, a) !== a('Current', 'Vigente')) return { key: 'stale', label: a('Stale', 'Vencida') };
  return { key: 'ok', label: a('Checked', 'Revisada') };
}
const shortDay = (iso, a) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(a.locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');

function AdminPanel({ signedIn = false }) {
  const a = useA();
  const FIELDS = fieldsFor(a);
  const fetchRules = useCallback(() => api.rules(undefined, true), []);
  const fetchChanges = useCallback(() => api.changes(), []);
  const rulesLoad = useLoad(fetchRules);
  // Spanish names for the built-in rules, for reading only. The edit form always works on the published English text.
  const fetchLoc = useCallback(() => (a.lang === 'es' ? api.rules('es', true) : Promise.resolve(null)), [a.lang]);
  const locLoad = useLoad(fetchLoc);
  const locById = Object.fromEntries((locLoad.data?.rules ?? []).map((r) => [r.id, r]));
  const nameOf = (r) => locById[r.id]?.title || r.title;
  const agencyOf = (r) => locById[r.id]?.agency || r.agency;
  // The change log keeps field keys like "source.url". Show them as the labels the editor uses.
  const fieldName = (k) => (k === 'rule' ? a('rule', 'regla') : k === 'applies' ? a('who sees it', 'quién la ve') : k === 'verification.status' ? a('marked as checked or needs check', 'marcada como revisada o falta revisar') : (FIELDS.find((x) => x.key === k)?.label || k));
  const reviewerName = (n) => (n === 'admin key' ? a('admin key', 'clave de administración') : n);
  const changesLoad = useLoad(fetchChanges);
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState({});
  const [checkNote, setCheckNote] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [audience, setAudience] = useState({ mode: 'always', field: '', value: '' });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [esForm, setEsForm] = useState({ title: '', agency: '', detail: '', sourceLabel: '', applyLabel: '' });
  const fieldsLoad = useLoad(useCallback(() => api.ruleFields(a.lang).catch(() => ({ fields: [] })), [a.lang]));
  const fields = fieldsLoad.data?.fields ?? [];

  const rules = rulesLoad.data?.rules ?? [];
  const rule = rules.find((r) => r.id === selected);

  // Fill the form with the saved values (an old saved draft still shows, and saving applies it).
  useEffect(() => {
    if (!rule) return;
    const f = {};
    FIELDS.forEach(({ key }) => { f[key] = rule.draft && key in rule.draft ? rule.draft[key] : getPath(rule, key); });
    setForm(f);
    setAudience(pickerFrom(rule.applies));
    setEsForm({ title: '', agency: '', detail: '', sourceLabel: '', applyLabel: '', ...(rule.es || {}) });
    setConfirmRemove(false);
    setConfirmOff(false);
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

  const live = rules.filter((r) => !r.disabled);
  const checkedCount = live.filter((r) => statusOf(r, a).key === 'ok').length;
  const needsCount = live.length - checkedCount;
  const dim = (r) => (filter === 'needs' ? statusOf(r, a).key === 'ok' : false);
  const ruleChanges = (changesLoad.data?.changes ?? []).filter((c) => c.ruleId === selected);

  return (
    <>
      <header className="desk-head">
        <h1 tabIndex={-1}>{a('Rule desk', 'Mesa de reglas')}</h1>
        <p className="lead">
          {needsCount === 0 ? a('Every rule has been checked against its official page.', 'Todas las reglas se revisaron contra su página oficial.') : a(`${needsCount} of ${live.length} rules need a check before you can trust them.`, `${needsCount} de ${live.length} reglas necesitan una revisión antes de confiar en ellas.`)}{' '}
          {a('Pick a rule to edit it or check it. Saved changes go live right away.', 'Elija una regla para editarla o revisarla. Los cambios guardados se publican de inmediato.')}
        </p>
        <p className="desk-add">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setAdding(true); setSelected(''); setMsg(''); setErr(''); setTimeout(() => document.getElementById('add-rule-h')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 60); }}>{a('Add a rule', 'Agregar una regla')}</button>
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
            {[['all', `${a('All', 'Todas')} ${rules.length}`], ['needs', `${a('Needs check', 'Falta revisar')} ${needsCount}`]].map(([k, label]) => (
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
                  onClick={() => { setSelected(r.id); setMsg(''); setErr(''); setTimeout(() => document.getElementById('desk-editor')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 60); }}
                >
                  <span className="tile-top">
                    <span className="tile-no">{String(i + 1).padStart(2, '0')}</span>
                    <span className="lamp" aria-hidden="true" />
                    <span className="tile-state">{st.label}</span>
                    {r.draft && <span className="tile-draft">{a('Draft', 'Borrador')}</span>}
                    {r.custom && <span className="tile-draft tile-added">{a('Added', 'Agregada')}</span>}
                    {r.disabled && <span className="tile-draft tile-off">{a('Hidden from new members', 'Oculta para miembros nuevos')}</span>}
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
            setMsg(a(`Rule added and live. Simulated notices queued: ${res.queuedNotifications}. It shows "Pending verification" until you mark it as checked.`, `Regla agregada y publicada. Avisos simulados en cola: ${res.queuedNotifications}. Muestra "Verificación pendiente" hasta que la marque como revisada.`));
          }}
        />
      )}

      <div id="desk-editor" className="desk-editor-anchor">
        {!rule && !adding && <p className="desk-empty">{a('Pick a rule on the board to read it, edit it and check it.', 'Elija una regla del tablero para leerla, editarla y revisarla.')}</p>}
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
                  </div>
                ))}
                <div className="row">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => run(() => api.saveRule(rule.id, form), (r) => (r.changed ? a(`Saved. Owners see the change now (version ${r.rule.version}). Simulated notices queued: ${r.queuedNotifications}.`, `Guardado. Los dueños ven el cambio ahora (versión ${r.rule.version}). Avisos simulados en cola: ${r.queuedNotifications}.`) : a('Nothing changed, so nothing was saved.', 'No hubo cambios, así que no se guardó nada.')))}>{a('Save changes', 'Guardar cambios')}</button>
                </div>
              </form>
            </section>

            <aside className="desk-side" aria-label={a('This rule today', 'Esta regla hoy')}>
              <h2>{a('Live now', 'En vivo ahora')}</h2>
              <dl className="desk-facts">
                <div><dt>{a('Status', 'Estado')}</dt><dd>{statusOf(rule, a).label}</dd></div>
                <div><dt>{a('Version', 'Versión')}</dt><dd>{rule.version}</dd></div>
                <div><dt>{a('Last verified', 'Última verificación')}</dt><dd>{rule.lastVerified || a('Never', 'Nunca')} <small>{staleness(rule, a)}</small></dd></div>
                <div><dt>{a('Owner', 'Responsable')}</dt><dd>{humanInput(rule.owner, a.lang)}</dd></div>
                <div><dt>{a('Checked by', 'Revisada por')}</dt><dd>{rule.reviewer || a('none yet', 'ninguno aún')}</dd></div>
                <div><dt>{a('Agency', 'Agencia')}</dt><dd>{agencyOf(rule)}</dd></div>
                              </dl>
              <div className="desk-check">
                <h3>{a('Check this rule', 'Revisar esta regla')}</h3>
                <ol className="hint">
                  <li>{a('Open the official page.', 'Abra la página oficial.')}</li>
                  <li>{a('Read it and compare it with the rule text.', 'Léala y compárela con el texto de la regla.')}</li>
                  <li>{a('If they match, click Mark as checked. If not, edit the rule and save.', 'Si coinciden, haga clic en Marcar como revisada. Si no, edite la regla y guarde.')}</li>
                </ol>
                {rule.source?.url && <p><ExternalLink className="btn btn-quiet btn-sm" href={rule.source.url}>{a('Open the source page', 'Abrir la página de la fuente')}</ExternalLink></p>}
                <div className="field">
                  <label htmlFor="check-note">{a('Note (optional)', 'Nota (opcional)')}</label>
                  <input type="text" id="check-note" maxLength={300} value={checkNote} onChange={(e) => setCheckNote(e.target.value)} placeholder={a('For example: fee is still $19', 'Por ejemplo: la tarifa sigue en $19')} />
                </div>
                <div className="row">
                  <button type="button" className="btn btn-primary btn-sm" onClick={async () => { await run(() => api.checkRule(rule.id, 'checked', checkNote), a('Marked as checked today.', 'Marcada como revisada hoy.')); setCheckNote(''); }}>{a('Mark as checked', 'Marcar como revisada')}</button>
                  {rule.verification?.status === 'checked' && (
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => run(() => api.checkRule(rule.id, 'pending', ''), a('Marked as needs check.', 'Marcada como falta revisar.'))}>{a('Mark as needs check', 'Marcar como falta revisar')}</button>
                  )}
                </div>
              </div>
              <div className="desk-onoff">
                {rule.disabled ? (
                  <>
                    <p className="hint">{a('This rule is disabled. New members do not see it. People who saved a plan before you disabled it keep it.', 'Esta regla está desactivada. Los miembros nuevos no la ven. Quienes guardaron un plan antes de que la desactivara la conservan.')}</p>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => run(() => api.enableRule(rule.id), a('Rule enabled. Everyone sees it again.', 'Regla activada. Todos la ven de nuevo.'))}>{a('Enable this rule', 'Activar esta regla')}</button>
                  </>
                ) : (
                  <>
                    <p className="hint">{a('Delete hides a rule from new members. People who already saved a plan keep it. Nothing is lost, and you can enable it again.', 'Eliminar oculta una regla para los miembros nuevos. Quienes ya guardaron un plan la conservan. No se pierde nada y puede activarla de nuevo.')}</p>
                    {confirmOff ? (
                      <div className="row">
                        <button type="button" className="btn btn-primary btn-sm" onClick={async () => { await run(() => api.disableRule(rule.id), a('Rule disabled. New members no longer see it, and people who already saved a plan keep it. You can enable it again here.', 'Regla desactivada. Los miembros nuevos ya no la ven y quienes ya guardaron un plan la conservan. Puede activarla de nuevo aquí.')); setConfirmOff(false); }}>{a('Yes, disable it', 'Sí, desactivarla')}</button>
                        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmOff(false)}>{a('Keep it', 'Conservarla')}</button>
                      </div>
                    ) : <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmOff(true)}>{a('Delete (disable) this rule', 'Eliminar (desactivar) esta regla')}</button>}
                  </>
                )}
              </div>
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
              ) : <p className="hint">{a('This is a built-in rule. Who sees it is fixed in the rules file. You can edit its text and links, or disable it.', 'Esta es una regla integrada. Quién la ve está fijo en el archivo de reglas. Puede editar su texto y sus enlaces, o desactivarla.')}</p>}
              <h3>{a('History of this rule', 'Historial de esta regla')}</h3>
              {ruleChanges.length === 0 ? <p className="hint">{a('No published changes yet.', 'Aún no hay cambios publicados.')}</p> : (
                <ul className="desk-history">
                  {ruleChanges.map((c) => (
                    <li key={c.id}><strong>{a('Version', 'Versión')} {c.version}</strong> {a('by', 'por')} {reviewerName(c.reviewer)}, {new Date(c.at).toLocaleDateString(a.locale)}. {a('Changed:', 'Cambió:')} {c.fields.map((f) => fieldName(f.field)).join(', ')}.</li>
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
              <strong>{a('Saving a change.', 'Guardar un cambio.')}</strong>{' '}
              {a('Save changes makes the edit live for every visitor at once. It adds one to the version number, records who saved it and the date, and queues a simulated notice for checklists that include the rule. It does not mark the rule as checked.',
                'Guardar cambios hace que la edición se vea de inmediato para todos los visitantes. Suma uno al número de versión, registra quién la guardó y la fecha, y pone en cola un aviso simulado para las listas que incluyen la regla. No marca la regla como revisada.')}
            </li>
            <li>
              <strong>{a('Verification status.', 'Estado de verificación.')}</strong>{' '}
              {a('Click Mark as checked only after you have read the official page and compared it with the rule. It sets today\'s date, adds a source review to the evidence log and adds a line to the history. A rule turns Stale after 12 months. Each rule has an owner field that reads "NEEDS HUMAN INPUT" until your team names a person.',
                'Haga clic en Marcar como revisada solo después de leer la página oficial y compararla con la regla. Pone la fecha de hoy, agrega una revisión de fuente al registro de evidencia y una línea al historial. Una regla pasa a Vencida después de 12 meses. Cada regla tiene un campo de responsable que dice "NEEDS HUMAN INPUT" hasta que su equipo nombre a una persona.')}
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
                <p>{a('Saved by', 'Guardada por')} {reviewerName(c.reviewer)} {a('on', 'el')} {new Date(c.at).toLocaleString(a.locale)}. {a('Fields changed:', 'Campos cambiados:')} {c.fields.map((f) => fieldName(f.field)).join(', ')}.</p>
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
