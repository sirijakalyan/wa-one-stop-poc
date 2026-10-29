import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useLoad } from '../api.js';
import { ErrorNote, Loading } from '../components/Parts.jsx';
import Icon from '../components/Icon.jsx';
import { CAT_LABEL, STRUCT_LABEL, YN_LABEL, countyLabel } from '../questions.js';

const EVENT = {
  signup: 'Created the account',
  login: 'Signed in',
  'plan-saved': 'Saved a plan',
  'plan-deleted': 'Started over (deleted the plan)',
  'step-done': 'Marked a step done',
  'step-undone': 'Marked a step not done',
  'renewal-set': 'Set a renewal date',
  'renewal-cleared': 'Cleared a renewal date',
  'password-reset': 'Changed the password',
  'role-changed': 'Role changed',
};
const when = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Never');
const day = (iso) => (iso ? new Date(iso).toLocaleDateString([], { dateStyle: 'medium' }) : 'Never');

function Bar({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className="mini-bar" role="img" aria-label={`${done} of ${total} steps done`}>
      <span className="mini-bar-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

function UserDetail({ id, onBack }) {
  const fetchOne = useCallback(() => api.adminUser(id), [id]);
  const { data, error, loading, reload } = useLoad(fetchOne);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  if (loading && !data) return <Loading what="Loading this user" />;
  if (error) return <><button type="button" className="btn btn-quiet btn-sm" onClick={onBack}>Back to users</button><ErrorNote message={error} /></>;
  const { user, checklist, events } = data;
  const a = checklist?.answers;
  const done = checklist ? checklist.items.filter((i) => i.done).length : 0;

  async function setRole(role) {
    setErr(''); setMsg('');
    try { await api.adminSetRole(user.id, role); setMsg(`Role set to ${role}.`); await reload(); } catch (e) { setErr(e.message); }
  }

  return (
    <>
      <p><button type="button" className="btn btn-quiet btn-sm" onClick={onBack}><Icon name="chevron" size={14} className="rot" /> Back to users</button></p>
      <header className="user-head">
        <span className="acct-initial big" aria-hidden="true">{(user.name || '?').charAt(0).toUpperCase()}</span>
        <div>
          <h2 tabIndex={-1}>{user.name}</h2>
          <p className="hint">{user.email} · Signed up {day(user.createdAt)} · Last sign-in {when(user.lastLoginAt)}</p>
        </div>
        <div className="user-role">
          <label htmlFor="role">Role</label>
          <select id="role" value={user.role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">Owner (user)</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </header>
      <ErrorNote message={err} />
      {msg && <p className="ok" role="status">{msg}</p>}

      <section className="panel wide" aria-labelledby="ud-answers">
        <h3 id="ud-answers">Saved answers</h3>
        {!a ? <p className="hint">No saved plan yet.</p> : (
          <dl className="answers">
            <div><dt>Plan name</dt><dd>{checklist.label || 'None'}</dd></div>
            <div><dt>Business structure</dt><dd>{STRUCT_LABEL[a.structure] || a.structure}</dd></div>
            <div><dt>What they do</dt><dd>{[a.desc, ...(a.cats || []).map((c) => CAT_LABEL[c] || c)].filter(Boolean).join(' · ') || 'Not given'}</dd></div>
            <div><dt>City and county</dt><dd>{[a.city, countyLabel(a.county)].filter(Boolean).join(', ') || 'Skipped'}</dd></div>
            <div><dt>Hiring within 90 days</dt><dd>{YN_LABEL[a.hiring] || 'Not answered'}</dd></div>
            <div><dt>Subcontractors</dt><dd>{YN_LABEL[a.subs] || 'Not answered'}</dd></div>
            <div><dt>Collects sales tax</dt><dd>{YN_LABEL[a.salestax] || 'Not answered'}</dd></div>
            <div><dt>Income $12,000 or more</dt><dd>{YN_LABEL[a.income] || 'Not answered'}</dd></div>
            <div><dt>Uses a business name</dt><dd>{YN_LABEL[a.tradename] || 'Not answered'}</dd></div>
            <div><dt>Saved</dt><dd>{when(checklist.savedAt)}</dd></div>
          </dl>
        )}
      </section>

      <section className="panel wide" aria-labelledby="ud-steps">
        <h3 id="ud-steps">Checklist progress {checklist && <span className="chip-count">{done} of {checklist.items.length} done</span>}</h3>
        {!checklist ? <p className="hint">Nothing to show until they save a plan.</p> : (
          <div className="table-scroll">
            <table className="stack">
              <thead><tr><th scope="col">Step</th><th scope="col">Agency</th><th scope="col">Status</th><th scope="col">Renewal date</th></tr></thead>
              <tbody>
                {checklist.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.title}</td>
                    <td data-label="Agency">{i.agency}</td>
                    <td data-label="Status"><span className={`pill ${i.done ? 'applies' : 'pending'}`}>{i.done ? 'Done' : 'Open'}</span></td>
                    <td data-label="Renewal date">{i.renewal || 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel wide" aria-labelledby="ud-activity">
        <h3 id="ud-activity">Activity ({events.length})</h3>
        {events.length === 0 ? <p className="hint">No activity yet.</p> : (
          <ol className="activity">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <time dateTime={e.at}>{when(e.at)}</time>
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
  const fetchUsers = useCallback(() => api.adminUsers(), []);
  const { data, error, loading } = useLoad(fetchUsers);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState('');
  const users = data?.users ?? [];
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(s)) : users;
  }, [users, q]);

  if (loading && !data) return <Loading what="Loading users" />;
  if (error) {
    return (
      <>
        <h1 tabIndex={-1}>Users</h1>
        <ErrorNote message={error} />
        <p><Link className="btn btn-primary btn-sm" to="/login" state={{ from: '/admin' }}>Sign in</Link></p>
      </>
    );
  }
  if (open) return <UserDetail id={open} onBack={() => setOpen('')} />;
  const savedCount = users.filter((u) => u.saved).length;
  return (
    <>
      <h1 tabIndex={-1}>Users</h1>
      <p className="lead">Everyone with an account, what they saved and how far they have got. Open a person to see their answers, their checklist and a dated activity log.</p>
      <ul className="stat-chips" aria-label="Summary">
        <li><strong>{users.length}</strong> accounts</li>
        <li><strong>{savedCount}</strong> with a saved plan</li>
        <li><strong>{users.filter((u) => u.role === 'admin').length}</strong> admins</li>
      </ul>
      <div className="field user-search">
        <label htmlFor="user-q">Search by name or email</label>
        <input id="user-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to filter" />
      </div>
      {users.length === 0 ? <p className="hint">No accounts yet. They appear here when someone signs up.</p> : (
        <div className="table-scroll">
          <table className="stack users-table">
            <thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Plan</th><th scope="col">Progress</th><th scope="col">Last active</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong><br /><span className="hint">{u.email}</span></td>
                  <td data-label="Role"><span className={`pill ${u.role === 'admin' ? 'applies' : 'maybe'}`}>{u.role === 'admin' ? 'Admin' : 'Owner'}</span></td>
                  <td data-label="Plan">{u.saved ? (u.label || 'Saved') : 'No plan yet'}</td>
                  <td data-label="Progress">{u.saved ? <><Bar done={u.done} total={u.total} /> <span className="hint">{u.done} of {u.total}</span></> : 'None'}</td>
                  <td data-label="Last active">{when(u.lastActivity || u.lastLoginAt || u.createdAt)}</td>
                  <td><button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(u.id)}>View<span className="sr-only"> {u.name}</span></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {users.length > 0 && shown.length === 0 && <p className="hint">No one matches that search.</p>}
    </>
  );
}
