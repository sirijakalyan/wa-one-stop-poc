import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';
import { api, getAdminKey, setAdminKey, useLoad } from '../api.js';
import { ErrorNote, Loading } from '../components/Parts.jsx';
import EvidencePanel from '../components/EvidencePanel.jsx';
import AdminUsers from './AdminUsers.jsx';
import Sources from './Sources.jsx';

const FIELDS = [
  { key: 'title', label: 'Requirement name', type: 'text' },
  { key: 'detail', label: 'Plain-language detail', type: 'area' },
  { key: 'source.label', label: 'Source name', type: 'text' },
  { key: 'source.url', label: 'Source link (https)', type: 'text' },
  { key: 'apply.label', label: 'Apply button text', type: 'text' },
  { key: 'apply.url', label: 'Apply link (https)', type: 'text' },
  { key: 'verification.status', label: 'Verification status', type: 'select' },
  { key: 'verification.note', label: 'Verification note', type: 'text' },
];
const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o) ?? '';
const STALE_DAYS = 365;

function staleness(rule) {
  if (!rule.lastVerified) return 'Not yet verified';
  const days = (Date.now() - new Date(rule.lastVerified).getTime()) / 86400000;
  return days > STALE_DAYS ? 'Stale: over 12 months' : 'Current';
}

function AdminPanel({ signedIn = false }) {
  const fetchRules = useCallback(() => api.rules(), []);
  const fetchChanges = useCallback(() => api.changes(), []);
  const rulesLoad = useLoad(fetchRules);
  const changesLoad = useLoad(fetchChanges);
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState({});
  const [reviewer, setReviewer] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const rules = rulesLoad.data?.rules ?? [];
  const rule = rules.find((r) => r.id === selected);

  // Fill the form with the published values, plus any saved draft.
  useEffect(() => {
    if (!rule) return;
    const f = {};
    FIELDS.forEach(({ key }) => { f[key] = rule.draft && key in rule.draft ? rule.draft[key] : getPath(rule, key); });
    setForm(f);
  }, [rule]);

  async function run(fn, success) {
    setErr('');
    setMsg('');
    try {
      const result = await fn();
      await rulesLoad.reload();
      await changesLoad.reload();
      if (success) setMsg(typeof success === 'function' ? success(result) : success);
      return result;
    } catch (e) {
      setErr(e.message);
      return null;
    }
  }

  if (rulesLoad.loading && !rulesLoad.data) return <Loading what="Loading rules" />;
  if (rulesLoad.error) return <ErrorNote message={rulesLoad.error} />;

  return (
    <>
      <h1 tabIndex={-1}>Rules management</h1>
      <p className="lead">
        Agency content owners edit a rule, review a side-by-side change, and approve it. Approval queues a simulated
        notice for saved checklists the rule affects.
      </p>
      <p className="note">
        {signedIn
          ? 'Unlocked for this browser (admin key or admin account). Published changes are live for every visitor.'
          : 'No admin key is set on this server, so anyone can edit. Use this only for local development.'}
      </p>
      <section className="panel who-edits" aria-labelledby="who-edits-h" data-testid="who-can-edit">
        <h2 id="who-edits-h">Who can edit</h2>
        <ul>
          <li>
            <strong>Admin accounts.</strong> A person whose account an admin made an admin signs in with their own email and password,
            and can edit rules, record source reviews and publish. Make or remove admins in the Users tab.
          </li>
          <li>
            <strong>The admin key.</strong> The shared secret set on the server (<code>ADMIN_KEY</code>) also unlocks this page for anyone who
            has it, but the app cannot tell who is using the key. If no key is set, as in local development, anyone who opens this
            page can edit. A production server with no key keeps this page locked.
          </li>
          <li>
            <strong>The reviewer.</strong> The reviewer is the person who compares a draft with the official agency page and approves it.
            They type their own name when they publish. The app saves that name and the date but cannot check that it is really them.
            The reviewer should be a different person from whoever wrote the draft.
          </li>
          <li>
            <strong>Draft changes.</strong> Save draft stores your edits only. Visitors see no change. You can discard a draft at any time.
          </li>
          <li>
            <strong>Publishing.</strong> Approve and publish makes the change live for every visitor, adds one to the version number,
            records the reviewer and the date, and queues a simulated notice for checklists that include the rule. Publishing cannot
            change who a rule applies to. That condition is fixed in the rules file.
          </li>
          <li>
            <strong>Verification status.</strong> Set "Checked" only after a person has read the official page and compared it with the
            rule. Recording a source review below does not change a rule's status by itself.
          </li>
          <li>
            <strong>Content owner.</strong> Each rule has an owner field. It reads "NEEDS HUMAN INPUT" until your team names a person.
          </li>
        </ul>
      </section>
      <ErrorNote message={err} />
      {msg && <p className="ok" role="status">{msg}</p>}

      <h2>Rules ({rules.length})</h2>
      <div className="table-scroll">
        <table className="stack">
          <thead>
            <tr>
              <th scope="col">Requirement</th><th scope="col">Agency</th><th scope="col">Verification</th>
              <th scope="col">Last verified</th><th scope="col">Version</th><th scope="col">Draft</th><th scope="col"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className={r.id === selected ? 'row-selected' : ''}>
                <td>{r.title}</td>
                <td data-label="Agency">{r.agency}</td>
                <td data-label="Verification">
                  <span className={`pill ${r.verification.status === 'checked' ? 'applies' : 'pending'}`}>
                    {r.verification.status === 'checked' ? 'Checked' : 'Pending check'}
                  </span>
                </td>
                <td data-label="Last verified">{r.lastVerified || 'None'}<br /><small>{staleness(r)}</small></td>
                <td data-label="Version">{r.version}</td>
                <td data-label="Draft">{r.draft ? 'Yes' : 'No'}</td>
                <td>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setSelected(r.id); setMsg(''); setErr(''); }}>
                    Edit<span className="sr-only"> {r.title}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rule && (
        <section className="panel editor" aria-labelledby="editor-h">
          <h2 id="editor-h">Edit: {rule.title}</h2>
          <p className="hint">
            Owner: {rule.owner}. Reviewer: {rule.reviewer || 'none yet'}. Authority and source: see the source link below.
            The condition that decides who sees this rule is fixed in the rules file and is not editable here.
          </p>
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
                    <option value="checked">Checked against the official page</option>
                    <option value="pending">Pending a second-person check</option>
                  </select>
                )}
              </div>
            ))}
            <div className="row">
              <button type="button" className="btn btn-sm" onClick={() => run(() => api.saveDraft(rule.id, form), 'Draft saved. Nothing is live until it is approved.')}>Save draft</button>
              {rule.draft && (
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => run(() => api.discardDraft(rule.id), 'Draft discarded.')}>Discard draft</button>
              )}
            </div>
          </form>

          {rule.draft && (
            <>
              <h3>Side-by-side change</h3>
              <div className="table-scroll">
                <table>
                  <thead><tr><th scope="col">Field</th><th scope="col">Published now</th><th scope="col">Draft</th></tr></thead>
                  <tbody>
                    {Object.entries(rule.draft).map(([k, v]) => (
                      <tr key={k}>
                        <td>{FIELDS.find((f) => f.key === k)?.label || k}</td>
                        <td className="from">{getPath(rule, k) || 'Empty'}</td>
                        <td className="to">{v || 'Empty'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="field">
                <label htmlFor="reviewer">Reviewer name (required to approve)</label>
                <input type="text" id="reviewer" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Name of the person approving" maxLength={80} />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => run(
                  () => api.publish(rule.id, reviewer),
                  (r) => `Published as version ${r.rule.version}. Simulated notices queued: ${r.queuedNotifications}.`,
                )}
              >
                Approve and publish
              </button>
            </>
          )}
        </section>
      )}

      {rules.length > 0 && <EvidencePanel rules={rules} />}

      <h2>Change history ({changesLoad.data?.changes?.length ?? 0})</h2>
      {(changesLoad.data?.changes ?? []).length === 0 && <p className="hint">No published changes yet.</p>}
      <ul className="notes">
        {(changesLoad.data?.changes ?? []).map((c) => (
          <li key={c.id} className="note-item">
            <h3>{c.ruleTitle} (version {c.version})</h3>
            <p>Approved by {c.reviewer} on {new Date(c.at).toLocaleString()}. Fields changed: {c.fields.map((f) => f.field).join(', ')}.</p>
          </li>
        ))}
      </ul>

      <h2>Reset demo data</h2>
      {!confirmReset ? (
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmReset(true)}>Reset demo data</button>
      ) : (
        <div className="row">
          <p className="hint">This restores the original rules and clears your checklist and notifications.</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setConfirmReset(false); setSelected(''); run(() => api.resetDemo(), 'Demo data reset.'); }}>Yes, reset</button>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmReset(false)}>Cancel</button>
        </div>
      )}
    </>
  );
}

// Shared admin key gate. The key is typed here, kept for this browser tab only, and sent as a header.
export default function Admin() {
  const fetchStatus = useCallback(() => api.adminStatus(), []);
  const { data, error, loading, reload } = useLoad(fetchStatus);
  const [key, setKey] = useState('');
  const [keyError, setKeyError] = useState('');
  const { user } = useApp();
  const [params, setParams] = useSearchParams();

  if (loading && !data) return <Loading what="Checking admin access" />;
  if (error) return <ErrorNote message={error} />;
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
        setKeyError('That key did not match. Check it and try again.');
      }
    }
    return (
      <div className="panel gate">
        <h1 tabIndex={-1}>Rules management</h1>
        {data.keyConfigured ? (
          <>
            <p className="lead">This area is for content owners. Enter the admin key to edit rules.</p>
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="admin-key">Admin key</label>
                <input id="admin-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={!key.trim()}>Unlock admin</button>
              <ErrorNote message={keyError} />
            </form>
            <p className="hint">Or <Link to="/login" state={{ from: '/admin' }}>sign in with an admin account</Link>. Who can edit: people with the admin key and people whose account an admin made an admin.</p>
          </>
        ) : (
          <>
          <p className="lead">Admin is locked. Sign in with an admin account, or the server owner can set an ADMIN_KEY.</p>
          {!user && <p><Link className="btn btn-primary btn-sm" to="/login" state={{ from: '/admin' }}>Sign in</Link></p>}
          </>
        )}
      </div>
    );
  }
  const tabs = [['users', 'Users'], ['rules', 'Rules and links'], ['sources', 'Official sources']];
  const tab = tabs.some(([k]) => k === params.get('tab')) ? params.get('tab') : (data?.strict ? 'users' : 'rules');
  return (
    <>
      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" id={`atab-${k}`} aria-selected={tab === k} aria-controls="admin-body" onClick={() => setParams({ tab: k })}>{label}</button>
        ))}
      </div>
      <div id="admin-body" role="tabpanel" aria-labelledby={`atab-${tab}`}>
        {tab === 'users' && (data?.strict ? <AdminUsers /> : (
          <>
            <h1 tabIndex={-1}>Users</h1>
            <p className="lead">Sign in with an admin account, or enter the admin key, to see who has signed up and what they did.</p>
            <p><Link className="btn btn-primary btn-sm" to="/login" state={{ from: '/admin' }}>Sign in</Link></p>
          </>
        ))}
        {tab === 'rules' && <AdminPanel signedIn={Boolean(data?.required && (getAdminKey() || data?.accountAdmin))} />}
        {tab === 'sources' && <Sources />}
      </div>
    </>
  );
}
