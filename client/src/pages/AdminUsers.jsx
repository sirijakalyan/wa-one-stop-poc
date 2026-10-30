import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useLoad } from '../api.js';
import { ErrorNote, Loading } from '../components/Parts.jsx';
import Icon from '../components/Icon.jsx';
import { useA } from '../adminText.js';
import { CAT_LABEL, STRUCT_LABEL, YN_LABEL, countyLabel } from '../questions.js';

const eventLabels = (tr) => ({
  signup: tr('Created the account', 'Creó la cuenta'),
  login: tr('Signed in', 'Inició sesión'),
  'plan-saved': tr('Saved a plan', 'Guardó un plan'),
  'plan-deleted': tr('Started over (deleted the plan)', 'Empezó de nuevo (borró el plan)'),
  'step-done': tr('Marked a step done', 'Marcó un paso como hecho'),
  'step-undone': tr('Marked a step not done', 'Marcó un paso como no hecho'),
  'renewal-set': tr('Set a renewal date', 'Fijó una fecha de renovación'),
  'renewal-cleared': tr('Cleared a renewal date', 'Borró una fecha de renovación'),
  'password-reset': tr('Changed the password', 'Cambió la contraseña'),
  'role-changed': tr('Role changed', 'Cambió el rol'),
});
const when = (iso, tr) => (iso ? new Date(iso).toLocaleString(tr.locale, { dateStyle: 'medium', timeStyle: 'short' }) : tr('Never', 'Nunca'));
const day = (iso, tr) => (iso ? new Date(iso).toLocaleDateString(tr.locale, { dateStyle: 'medium' }) : tr('Never', 'Nunca'));

function Bar({ done, total }) {
  const tr = useA();
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className="mini-bar" role="img" aria-label={tr(`${done} of ${total} steps done`, `${done} de ${total} pasos hechos`)}>
      <span className="mini-bar-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

function UserDetail({ id, onBack }) {
  const tr = useA();
  const EVENT = eventLabels(tr);
  const fetchOne = useCallback(() => api.adminUser(id), [id]);
  const { data, error, loading, reload } = useLoad(fetchOne);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  if (loading && !data) return <Loading what={tr('Loading this user', 'Cargando a esta persona')} />;
  if (error) return <><button type="button" className="btn btn-quiet btn-sm" onClick={onBack}>{tr('Back to users', 'Volver a Personas')}</button><ErrorNote message={error} /></>;
  const { user, events } = data;
  const lists = data.checklists || (data.checklist ? [data.checklist] : []);

  async function setRole(role) {
    setErr(''); setMsg('');
    try { await api.adminSetRole(user.id, role); setMsg(tr(`Role set to ${role}.`, `Rol cambiado a ${role === 'admin' ? 'administrador' : 'propietario'}.`)); await reload(); } catch (e) { setErr(e.message); }
  }

  return (
    <>
      <p><button type="button" className="btn btn-quiet btn-sm" onClick={onBack}><Icon name="chevron" size={14} className="rot" /> {tr('Back to users', 'Volver a Personas')}</button></p>
      <header className="user-head">
        <span className="acct-initial big" aria-hidden="true">{(user.name || '?').charAt(0).toUpperCase()}</span>
        <div>
          <h2 tabIndex={-1}>{user.name}</h2>
          <p className="hint">{user.email} · {tr('Signed up', 'Se registró')} {day(user.createdAt, tr)} · {tr('Last sign-in', 'Último inicio de sesión')} {when(user.lastLoginAt, tr)}</p>
        </div>
        <div className="user-role">
          <label htmlFor="role">{tr('Role', 'Rol')}</label>
          <select id="role" value={user.role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">{tr('Owner (user)', 'Propietario (usuario)')}</option>
            <option value="admin">{tr('Admin', 'Administrador')}</option>
          </select>
        </div>
      </header>
      <ErrorNote message={err} />
      {msg && <p className="ok" role="status">{msg}</p>}

      {lists.length === 0 && (
        <section className="panel wide" aria-labelledby="ud-answers">
          <h3 id="ud-answers">{tr('Saved answers', 'Respuestas guardadas')}</h3>
          <p className="hint">{tr('No saved plan yet.', 'Aún no hay un plan guardado.')}</p>
        </section>
      )}
      {lists.map((checklist, n) => {
        const a = checklist.answers; // the person's answers
        const done = checklist.items.filter((i) => i.done).length;
        const k = lists.length > 1 ? `-${n}` : '';
        return (
          <div key={checklist.id} className="ud-business">
            {lists.length > 1 && <h3 className="ud-business-title">{tr('Business', 'Negocio')} {n + 1} {tr('of', 'de')} {lists.length}: {checklist.label || tr('Untitled', 'Sin título')}</h3>}
            <section className="panel wide" aria-labelledby={`ud-answers${k}`}>
              <h3 id={`ud-answers${k}`}>{tr('Saved answers', 'Respuestas guardadas')}</h3>
              <dl className="answers">
                <div><dt>{tr('Plan name', 'Nombre del plan')}</dt><dd>{checklist.label || tr('None', 'Ninguno')}</dd></div>
                <div><dt>{tr('Business structure', 'Estructura del negocio')}</dt><dd>{STRUCT_LABEL[a.structure] || a.structure}</dd></div>
                <div><dt>{tr('What they do', 'A qué se dedica')}</dt><dd>{[a.desc, ...(a.cats || []).map((c) => CAT_LABEL[c] || c)].filter(Boolean).join(' · ') || tr('Not given', 'Sin indicar')}</dd></div>
                <div><dt>{tr('City and county', 'Ciudad y condado')}</dt><dd>{[a.city, countyLabel(a.county)].filter(Boolean).join(', ') || tr('Skipped', 'Omitido')}</dd></div>
                <div><dt>{tr('Hiring within 90 days', 'Contratará en 90 días')}</dt><dd>{YN_LABEL[a.hiring] || tr('Not answered', 'Sin responder')}</dd></div>
                <div><dt>{tr('Subcontractors', 'Subcontratistas')}</dt><dd>{YN_LABEL[a.subs] || tr('Not answered', 'Sin responder')}</dd></div>
                <div><dt>{tr('Collects sales tax', 'Cobra impuesto sobre ventas')}</dt><dd>{YN_LABEL[a.salestax] || tr('Not answered', 'Sin responder')}</dd></div>
                <div><dt>{tr('Income $12,000 or more', 'Ingresos de $12,000 o más')}</dt><dd>{YN_LABEL[a.income] || tr('Not answered', 'Sin responder')}</dd></div>
                <div><dt>{tr('Uses a business name', 'Usa un nombre comercial')}</dt><dd>{YN_LABEL[a.tradename] || tr('Not answered', 'Sin responder')}</dd></div>
                <div><dt>{tr('Saved', 'Guardado')}</dt><dd>{when(checklist.savedAt, tr)}</dd></div>
              </dl>
            </section>

            <section className="panel wide" aria-labelledby={`ud-steps${k}`}>
              <h3 id={`ud-steps${k}`}>{tr('Checklist progress', 'Avance de la lista')} <span className="chip-count">{done} {tr('of', 'de')} {checklist.items.length} {tr('done', 'hechos')}</span></h3>
              <div className="table-scroll">
                <table className="stack">
                  <thead><tr><th scope="col">{tr('Step', 'Paso')}</th><th scope="col">{tr('Agency', 'Agencia')}</th><th scope="col">{tr('Status', 'Estado')}</th><th scope="col">{tr('Renewal date', 'Fecha de renovación')}</th></tr></thead>
                  <tbody>
                    {checklist.items.map((i) => (
                      <tr key={i.id}>
                        <td>{i.title}</td>
                        <td data-label={tr('Agency', 'Agencia')}>{i.agency}</td>
                        <td data-label={tr('Status', 'Estado')}><span className={`pill ${i.done ? 'applies' : 'pending'}`}>{i.done ? tr('Done', 'Hecho') : tr('Open', 'Pendiente')}</span></td>
                        <td data-label={tr('Renewal date', 'Fecha de renovación')}>{i.renewal || tr('None', 'Ninguna')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        );
      })}

      <section className="panel wide" aria-labelledby="ud-activity">
        <h3 id="ud-activity">{tr('Activity', 'Actividad')} ({events.length})</h3>
        {events.length === 0 ? <p className="hint">{tr('No activity yet.', 'Aún no hay actividad.')}</p> : (
          <ol className="activity">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <time dateTime={e.at}>{when(e.at, tr)}</time>
                <span><strong>{EVENT[e.type] || e.type}</strong>{e.detail && !['signup', 'login'].includes(e.type) ? `: ${e.detail}` : ''}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

export default function AdminUsers() {
  const tr = useA();
  const fetchUsers = useCallback(() => api.adminUsers(), []);
  const { data, error, loading } = useLoad(fetchUsers);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState('');
  const users = data?.users ?? [];
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(s)) : users;
  }, [users, q]);

  if (loading && !data) return <Loading what={tr('Loading people', 'Cargando personas')} />;
  if (error) {
    return (
      <>
        <h1 tabIndex={-1}>{tr('People', 'Personas')}</h1>
        <ErrorNote message={error} />
        <p><Link className="btn btn-primary btn-sm" to="/login" state={{ from: '/admin' }}>{tr('Sign in', 'Iniciar sesión')}</Link></p>
      </>
    );
  }
  if (open) return <UserDetail id={open} onBack={() => setOpen('')} />;
  const savedCount = users.filter((u) => u.saved).length;
  return (
    <>
      <h1 tabIndex={-1}>{tr('People', 'Personas')}</h1>
      <p className="lead">{tr('Everyone with an account, what they saved and how far they have got. Open a person to see their answers, their checklist and a dated activity log.', 'Todas las personas con cuenta, lo que guardaron y cuánto han avanzado. Abra a una persona para ver sus respuestas, su lista y un registro de actividad con fechas.')}</p>
      <ul className="stat-chips" aria-label={tr('Summary', 'Resumen')}>
        <li><strong>{users.length}</strong> {tr('accounts', 'cuentas')}</li>
        <li><strong>{savedCount}</strong> {tr('with a saved plan', 'con un plan guardado')}</li>
        <li><strong>{users.reduce((n, u) => n + (u.businesses?.length || 0), 0)}</strong> {tr('businesses saved', 'negocios guardados')}</li>
        <li><strong>{users.filter((u) => u.role === 'admin').length}</strong> {tr('admins', 'administradores')}</li>
      </ul>
      <div className="field user-search">
        <label htmlFor="user-q">{tr('Search by name or email', 'Buscar por nombre o correo')}</label>
        <input id="user-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Type to filter', 'Escriba para filtrar')} />
      </div>
      {users.length === 0 ? <p className="hint">{tr('No accounts yet. They appear here when someone signs up.', 'Aún no hay cuentas. Aparecen aquí cuando alguien se registra.')}</p> : (
        <div className="table-scroll">
          <table className="stack users-table">
            <thead><tr><th scope="col">{tr('Person', 'Persona')}</th><th scope="col">{tr('Role', 'Rol')}</th><th scope="col">{tr('Plan', 'Plan')}</th><th scope="col">{tr('Progress', 'Avance')}</th><th scope="col">{tr('Last active', 'Última actividad')}</th><th scope="col"><span className="sr-only">{tr('Open', 'Abrir')}</span></th></tr></thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong><br /><span className="hint">{u.email}</span></td>
                  <td data-label={tr('Role', 'Rol')}><span className={`pill ${u.role === 'admin' ? 'applies' : 'maybe'}`}>{u.role === 'admin' ? tr('Admin', 'Administrador') : tr('Owner', 'Propietario')}</span></td>
                  <td data-label={tr('Plan', 'Plan')}>{!u.saved ? tr('No plan yet', 'Sin plan aún') : (u.businesses?.length || 0) > 1 ? <>{u.businesses.length} {tr('businesses', 'negocios')}<br /><span className="hint">{u.businesses.map((b) => b.label || tr('Untitled', 'Sin título')).join(', ')}</span></> : (u.label || tr('Saved', 'Guardado'))}</td>
                  <td data-label={tr('Progress', 'Avance')}>{u.saved ? <><Bar done={u.done} total={u.total} /> <span className="hint">{u.done} {tr('of', 'de')} {u.total}</span></> : tr('None', 'Ninguno')}</td>
                  <td data-label={tr('Last active', 'Última actividad')}>{when(u.lastActivity || u.lastLoginAt || u.createdAt, tr)}</td>
                  <td><button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(u.id)}>{tr('View', 'Ver')}<span className="sr-only"> {u.name}</span></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {users.length > 0 && shown.length === 0 && <p className="hint">{tr('No one matches that search.', 'Nadie coincide con esa búsqueda.')}</p>}
    </>
  );
}
