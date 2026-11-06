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

const YN_ES = { yes: 'Sí', no: 'No', unsure: 'No estoy seguro' };
const STRUCT_ES = { sole: 'Propietario único', gp: 'Sociedad colectiva', lp: 'Sociedad en comandita (LP)', lllp: 'LLLP', llp: 'LLP', llc: 'LLC', plc: 'LLC profesional (PLLC)', corp: 'Corporación', psc: 'Corporación de servicios profesionales', benefit: 'Corporación de beneficio social', spc: 'Corporación con propósito social', nonprofit: 'Corporación sin fines de lucro', coop: 'Cooperativa', partnership: 'Sociedad o LLP', unsure: 'Estructura aún sin decidir' };
const CAT_ES = { food: 'Servicio de comida', construction: 'Contratación de construcción', other: 'Otro servicio o venta' };

function UserDetail({ id, onBack, visitor = false }) {
  const tr = useA();
  const EVENT = eventLabels(tr);
  const fetchOne = useCallback(() => (visitor ? api.adminVisitor(id, tr.lang) : api.adminUser(id, tr.lang)), [id, tr.lang, visitor]);
  const { data, error, loading, reload } = useLoad(fetchOne);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  if (loading && !data) return <Loading what={tr('Loading this user', 'Cargando a esta persona')} />;
  if (error) return <><button type="button" className="btn btn-quiet btn-sm" onClick={onBack}>{tr('Back to the list', 'Volver a la lista')}</button><ErrorNote message={error} /></>;
  const user = visitor ? { id, name: `${tr('Visitor', 'Visitante')} ${data.visitor.shortId}`, email: '', role: 'visitor' } : data.user;
  const events = data.events || [];
  const lists = data.checklists || (data.checklist ? [data.checklist] : []);
  // Event details start with a step title in English. Show the title in the page language.
  const titles = lists.flatMap((l) => l.items).filter((i) => i.titleEn && i.titleEn !== i.title);
  const detailText = (d) => {
    const hit = titles.find((i) => d.startsWith(i.titleEn));
    return hit ? hit.title + d.slice(hit.titleEn.length) : d;
  };

  async function setRole(role) {
    setErr(''); setMsg('');
    try { await api.adminSetRole(user.id, role); setMsg(tr(`Role set to ${role}.`, `Rol cambiado a ${role === 'admin' ? 'administrador' : 'propietario'}.`)); await reload(); } catch (e) { setErr(e.message); }
  }

  return (
    <>
      <p><button type="button" className="btn btn-quiet btn-sm" onClick={onBack}><Icon name="chevron" size={14} className="rot" /> {tr('Back to the list', 'Volver a la lista')}</button></p>
      <header className="user-head">
        <span className="acct-initial big" aria-hidden="true">{visitor ? '#' : (user.name || '?').charAt(0).toUpperCase()}</span>
        <div>
          <h2 tabIndex={-1}>{user.name}</h2>
          <p className="hint">{visitor ? tr('No account. This is a plan saved on a device, identified only by a random ID. There is no name or email.', 'Sin cuenta. Es un plan guardado en un dispositivo, identificado solo por un ID al azar. No hay nombre ni correo.') : <>{user.email} · {tr('Signed up', 'Se registró')} {day(user.createdAt, tr)} · {tr('Last sign-in', 'Último inicio de sesión')} {when(user.lastLoginAt, tr)}</>}</p>
        </div>
        {!visitor && <div className="user-role">
          <label htmlFor="role">{tr('Role', 'Rol')}</label>
          <select id="role" value={user.role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">{tr('Owner (user)', 'Propietario (usuario)')}</option>
            <option value="admin">{tr('Admin', 'Administrador')}</option>
          </select>
        </div>}
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
                <div><dt>{tr('Business structure', 'Estructura del negocio')}</dt><dd>{(tr.lang === 'es' ? STRUCT_ES : STRUCT_LABEL)[a.structure] || a.structure}</dd></div>
                <div><dt>{tr('What they do', 'A qué se dedica')}</dt><dd>{[a.desc, ...(a.cats || []).map((c) => (tr.lang === 'es' ? CAT_ES : CAT_LABEL)[c] || c)].filter(Boolean).join(' · ') || tr('Not given', 'Sin indicar')}</dd></div>
                <div><dt>{tr('City and county', 'Ciudad y condado')}</dt><dd>{[a.city, (tr.lang === 'es' ? countyLabel(a.county).replace(/ County$/, '').replace(/^/, 'Condado de ') : countyLabel(a.county))].filter(Boolean).join(', ') || tr('Skipped', 'Omitido')}</dd></div>
                <div><dt>{tr('Hiring within 90 days', 'Contratará en 90 días')}</dt><dd>{(tr.lang === 'es' ? YN_ES : YN_LABEL)[a.hiring] || tr('Not answered', 'Sin responder')}</dd></div>
                <div><dt>{tr('Subcontractors', 'Subcontratistas')}</dt><dd>{(tr.lang === 'es' ? YN_ES : YN_LABEL)[a.subs] || tr('Not answered', 'Sin responder')}</dd></div>
                <div><dt>{tr('Collects sales tax', 'Cobra impuesto sobre ventas')}</dt><dd>{(tr.lang === 'es' ? YN_ES : YN_LABEL)[a.salestax] || tr('Not answered', 'Sin responder')}</dd></div>
                <div><dt>{tr('Income $12,000 or more', 'Ingresos de $12,000 o más')}</dt><dd>{(tr.lang === 'es' ? YN_ES : YN_LABEL)[a.income] || tr('Not answered', 'Sin responder')}</dd></div>
                <div><dt>{tr('Uses a business name', 'Usa un nombre comercial')}</dt><dd>{(tr.lang === 'es' ? YN_ES : YN_LABEL)[a.tradename] || tr('Not answered', 'Sin responder')}</dd></div>
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

      {!visitor && <section className="panel wide ud-activity-panel" aria-labelledby="ud-activity">
        <details className="fold">
          <summary>
            <span id="ud-activity" className="fold-title">{tr('Activity of', 'Actividad de')} {user.name} ({events.length})</span>
            {events[0] && <span className="fold-latest">{tr('Latest', 'Último')}: {EVENT[events[0].type] || events[0].type}, {when(events[0].at, tr)}</span>}
          </summary>
          {events.length === 0 ? <p className="hint">{tr('No activity yet.', 'Aún no hay actividad.')}</p> : (
            <ol className="activity">
              {events.map((e, i) => (
                <li key={`${e.at}-${i}`}>
                  <time dateTime={e.at}>{when(e.at, tr)}</time>
                  <span><strong>{EVENT[e.type] || e.type}</strong>{e.detail && !['signup', 'login'].includes(e.type) ? `: ${detailText(e.detail)}` : ''}</span>
                </li>
              ))}
            </ol>
          )}
        </details>
      </section>}
    </>
  );
}

export default function AdminUsers() {
  const tr = useA();
  const fetchUsers = useCallback(() => api.adminUsers(), []);
  const { data, error, loading } = useLoad(fetchUsers);
  const fetchVisitors = useCallback(() => api.adminVisitors(), []);
  const { data: vdata } = useLoad(fetchVisitors);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('users'); // admins | users | visitors
  const [open, setOpen] = useState(null); // { id, visitor }
  const people = data?.users ?? [];
  const visitors = vdata?.visitors ?? [];
  const admins = people.filter((u) => u.role === 'admin');
  const owners = people.filter((u) => u.role !== 'admin');
  const rows = group === 'admins' ? admins : group === 'visitors' ? visitors : owners;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((u) => (group === 'visitors' ? u.id : `${u.name} ${u.email}`).toLowerCase().includes(s));
  }, [rows, q, group]);

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
  if (open) return <UserDetail id={open.id} visitor={open.visitor} onBack={() => setOpen(null)} />;
  const boxes = [
    { key: 'admins', n: admins.length, label: tr('Admins', 'Administradores'), hint: tr('Staff who edit the rules', 'Personal que edita las reglas') },
    { key: 'users', n: owners.length, label: tr('Users', 'Usuarios'), hint: tr('Owners with an account', 'Propietarios con cuenta') },
    { key: 'visitors', n: visitors.length, label: tr('Visitors', 'Visitantes'), hint: tr('Plans saved with no account', 'Planes guardados sin cuenta') },
  ];
  const empty = group === 'visitors'
    ? tr('No visitors yet. They appear here when someone saves a plan on a device without an account.', 'Aún no hay visitantes. Aparecen aquí cuando alguien guarda un plan en un dispositivo sin cuenta.')
    : tr('No one here yet. People appear when they sign up.', 'Aún no hay nadie. Las personas aparecen cuando se registran.');
  const planCell = (u) => (!u.saved && group !== 'visitors' ? tr('No plan yet', 'Sin plan aún') : (u.businesses?.length || 0) > 1 ? <>{u.businesses.length} {tr('businesses', 'negocios')}<br /><span className="hint">{u.businesses.map((b) => b.label || tr('Untitled', 'Sin título')).join(', ')}</span></> : (u.label || u.businesses?.[0]?.label || tr('Saved', 'Guardado')));
  return (
    <>
      <h1 tabIndex={-1}>{tr('People', 'Personas')}</h1>
      <p className="lead">{tr('Pick a group. Admins and users have an account. Visitors saved a plan on a device with no account, so they show only as a random ID. Open one to see the answers and the checklist.', 'Elija un grupo. Administradores y usuarios tienen cuenta. Los visitantes guardaron un plan en un dispositivo sin cuenta, por eso solo aparecen como un ID al azar. Abra uno para ver las respuestas y la lista.')}</p>
      <ul className="people-groups" aria-label={tr('Groups', 'Grupos')}>
        {boxes.map((b) => (
          <li key={b.key}>
            <button type="button" className={`people-box${group === b.key ? ' is-on' : ''}`} aria-pressed={group === b.key} onClick={() => { setGroup(b.key); setQ(''); }}>
              <strong>{b.n}</strong>
              <span className="people-box-name">{b.label}</span>
              <span className="hint">{b.hint}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="field user-search">
        <label htmlFor="user-q">{group === 'visitors' ? tr('Search by visitor ID', 'Buscar por ID de visitante') : tr('Search by name or email', 'Buscar por nombre o correo')}</label>
        <input id="user-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Type to filter', 'Escriba para filtrar')} />
      </div>
      {rows.length === 0 ? <p className="hint">{empty}</p> : (
        <div className="table-scroll">
          <table className="stack users-table">
            <thead><tr><th scope="col">{group === 'visitors' ? tr('Visitor', 'Visitante') : tr('Person', 'Persona')}</th>{group !== 'visitors' && <th scope="col">{tr('Role', 'Rol')}</th>}<th scope="col">{tr('Plan', 'Plan')}</th><th scope="col">{tr('Progress', 'Avance')}</th><th scope="col">{group === 'visitors' ? tr('Last saved', 'Último guardado') : tr('Last active', 'Última actividad')}</th><th scope="col"><span className="sr-only">{tr('Open', 'Abrir')}</span></th></tr></thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id}>
                  {group === 'visitors'
                    ? <td><strong>{tr('Visitor', 'Visitante')} {u.shortId}</strong><br /><span className="hint">{tr('No account', 'Sin cuenta')}</span></td>
                    : <td><strong>{u.name}</strong><br /><span className="hint">{u.email}</span></td>}
                  {group !== 'visitors' && <td data-label={tr('Role', 'Rol')}><span className={`pill ${u.role === 'admin' ? 'applies' : 'maybe'}`}>{u.role === 'admin' ? tr('Admin', 'Administrador') : tr('Owner', 'Propietario')}</span></td>}
                  <td data-label={tr('Plan', 'Plan')}>{planCell(u)}</td>
                  <td data-label={tr('Progress', 'Avance')}>{u.saved || group === 'visitors' ? <><Bar done={u.done} total={u.total} /> <span className="hint">{u.done} {tr('of', 'de')} {u.total}</span></> : tr('None', 'Ninguno')}</td>
                  <td data-label={group === 'visitors' ? tr('Last saved', 'Último guardado') : tr('Last active', 'Última actividad')}>{group === 'visitors' ? when(u.lastSaved, tr) : when(u.lastActivity || u.lastLoginAt || u.createdAt, tr)}</td>
                  <td><button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen({ id: u.id, visitor: group === 'visitors' })}>{tr('View', 'Ver')}<span className="sr-only"> {group === 'visitors' ? u.shortId : u.name}</span></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && shown.length === 0 && <p className="hint">{tr('No one matches that search.', 'Nadie coincide con esa búsqueda.')}</p>}
    </>
  );
}
