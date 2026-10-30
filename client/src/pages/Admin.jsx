import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';
import { api, getAdminKey, setAdminKey, useLoad } from '../api.js';
import { ErrorNote, Loading } from '../components/Parts.jsx';
import EvidencePanel from '../components/EvidencePanel.jsx';
import ExternalLink from '../components/ExternalLink.jsx';
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

// One verification state per rule, shown as a lamp on its tile.
function statusOf(r) {
  if (r.verification.status !== 'checked' || !r.lastVerified) return { key: 'needs', label: 'Needs check' };
  if (staleness(r) !== 'Current') return { key: 'stale', label: 'Stale' };
  return { key: 'ok', label: 'Checked' };
}
const shortDay = (iso) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');

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
  const [filter, setFilter] = useState('all');

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

  const checkedCount = rules.filter((r) => statusOf(r).key === 'ok').length;
  const needsCount = rules.length - checkedCount;
  const draftCount = rules.filter((r) => r.draft).length;
  const dim = (r) => (filter === 'needs' ? statusOf(r).key === 'ok' : filter === 'drafts' ? !r.draft : false);
  const ruleChanges = (changesLoad.data?.changes ?? []).filter((c) => c.ruleId === selected);

  return (
    <>
      <header className="desk-head">
        <h1 tabIndex={-1}>Rule desk</h1>
        <p className="lead">
          {needsCount === 0 ? 'Every rule has been checked against its official page.' : `${needsCount} of ${rules.length} rules need a check before you can trust them.`}{' '}
          Pick a rule to edit it. Nothing goes live until a second person approves it.
        </p>
        <p className="desk-note">
          {signedIn
            ? 'Unlocked for this browser. Published changes are live for every visitor.'
            : 'No admin key is set on this server, so anyone can edit. Use this only for local development.'}
        </p>
      </header>

      <section className="board" aria-labelledby="board-h">
        <div className="board-top">
          <h2 id="board-h" className="board-title"><strong>{checkedCount}</strong> of {rules.length} rules checked</h2>
          <div className="board-filters" role="group" aria-label="Show">
            {[['all', `All ${rules.length}`], ['needs', `Needs check ${needsCount}`], ['drafts', `Has a draft ${draftCount}`]].map(([k, label]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
        </div>
        <ul className="board-grid">
          {rules.map((r, i) => {
            const st = statusOf(r);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className={`tile tile--${st.key}${r.id === selected ? ' is-on' : ''}${dim(r) ? ' is-dim' : ''}`}
                  aria-pressed={r.id === selected}
                  aria-label={`${r.title}. ${st.label}${r.draft ? '. Has a draft' : ''}`}
                  onClick={() => { setSelected(r.id); setMsg(''); setErr(''); setTimeout(() => document.getElementById('desk-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }}
                >
                  <span className="tile-top">
                    <span className="tile-no">{String(i + 1).padStart(2, '0')}</span>
                    <span className="lamp" aria-hidden="true" />
                    <span className="tile-state">{st.label}</span>
                    {r.draft && <span className="tile-draft">Draft</span>}
                  </span>
                  <span className="tile-title">{r.title}</span>
                  <span className="tile-foot">{r.agency} · {r.lastVerified ? `checked ${shortDay(r.lastVerified)}` : 'never checked'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <ErrorNote message={err} />
      {msg && <p className="ok" role="status">{msg}</p>}

      <div id="desk-editor" className="desk-editor-anchor">
        {!rule && <p className="desk-empty">Pick a rule on the board to read it, edit it and send it for a second check.</p>}
        {rule && (
          <div className="desk-editor">
            <section className="panel editor" aria-labelledby="editor-h">
              <h2 id="editor-h">Edit: {rule.title}</h2>
              <p className="hint">The condition that decides who sees this rule is fixed in the rules file and is not editable here.</p>
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

            <aside className="desk-side" aria-label="This rule today">
              <h2>Live now</h2>
              <dl className="desk-facts">
                <div><dt>Status</dt><dd>{statusOf(rule).label}</dd></div>
                <div><dt>Version</dt><dd>{rule.version}</dd></div>
                <div><dt>Last verified</dt><dd>{rule.lastVerified || 'Never'} <small>{staleness(rule)}</small></dd></div>
                <div><dt>Owner</dt><dd>{rule.owner}</dd></div>
                <div><dt>Reviewer</dt><dd>{rule.reviewer || 'none yet'}</dd></div>
                <div><dt>Agency</dt><dd>{rule.agency}</dd></div>
                <div><dt>Draft</dt><dd>{rule.draft ? 'Yes, waiting for approval' : 'No'}</dd></div>
              </dl>
              {rule.source?.url && <p><ExternalLink className="btn btn-quiet btn-sm" href={rule.source.url}>Open the source page</ExternalLink></p>}
              <h3>History of this rule</h3>
              {ruleChanges.length === 0 ? <p className="hint">No published changes yet.</p> : (
                <ul className="desk-history">
                  {ruleChanges.map((c) => (
                    <li key={c.id}><strong>Version {c.version}</strong> approved by {c.reviewer}, {new Date(c.at).toLocaleDateString()}. Changed: {c.fields.map((f) => f.field).join(', ')}.</li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        )}
      </div>

      <div className="desk-more">
        <details className="who-edits" data-testid="who-can-edit">
          <summary>How editing works and who can edit</summary>
          <ul>
            <li>
              <strong>Admin accounts.</strong> A person whose account an admin made an admin signs in with their own email and password,
              and can edit rules, record source reviews and publish. Make or remove admins in the People tab.
            </li>
            <li>
              <strong>The admin key.</strong> The shared secret set on the server (<code>ADMIN_KEY</code>) also unlocks this page for anyone who
              has it, but the app cannot tell who is using the key. A production server with no key keeps this page locked.
            </li>
            <li>
              <strong>The reviewer.</strong> The reviewer compares a draft with the official agency page and approves it. They type their own name
              when they publish. The app saves that name and the date but cannot check that it is really them. The reviewer should be a different
              person from whoever wrote the draft.
            </li>
            <li>
              <strong>Draft and publish.</strong> Save draft stores your edits only. Approve and publish makes the change live for every visitor,
              adds one to the version number, records the reviewer and the date, and queues a simulated notice for checklists that include the rule.
              Publishing cannot change who a rule applies to.
            </li>
            <li>
              <strong>Verification status.</strong> Set "Checked" only after a person has read the official page and compared it with the rule.
              Recording a source review does not change a rule's status by itself. Each rule has an owner field that reads "NEEDS HUMAN INPUT" until your team names a person.
            </li>
          </ul>
        </details>

        {rules.length > 0 && (
          <details>
            <summary>Evidence: source reviews and county pages</summary>
            <EvidencePanel rules={rules} />
          </details>
        )}

        <details>
          <summary>Official sources and how this demo works</summary>
          <Sources embedded />
        </details>

        <details>
          <summary>Change history ({changesLoad.data?.changes?.length ?? 0})</summary>
          {(changesLoad.data?.changes ?? []).length === 0 && <p className="hint">No published changes yet.</p>}
          <ul className="notes">
            {(changesLoad.data?.changes ?? []).map((c) => (
              <li key={c.id} className="note-item">
                <h3>{c.ruleTitle} (version {c.version})</h3>
                <p>Approved by {c.reviewer} on {new Date(c.at).toLocaleString()}. Fields changed: {c.fields.map((f) => f.field).join(', ')}.</p>
              </li>
            ))}
          </ul>
        </details>

        <details>
          <summary>Reset demo data</summary>
          {!confirmReset ? (
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmReset(true)}>Reset demo data</button>
          ) : (
            <div className="row">
              <p className="hint">This restores the original rules and clears your checklist and notifications.</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { setConfirmReset(false); setSelected(''); run(() => api.resetDemo(), 'Demo data reset.'); }}>Yes, reset</button>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          )}
        </details>
      </div>
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
        <h1 tabIndex={-1}>Rule desk</h1>
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
  const tabs = [['rules', 'Rules'], ['people', 'People']];
  const asked = params.get('tab');
  const wanted = asked === 'users' ? 'people' : asked === 'sources' ? 'rules' : asked;
  const tab = tabs.some(([k]) => k === wanted) ? wanted : (data?.strict ? 'people' : 'rules');
  return (
    <>
      <div className="admin-tabs desk-switch" role="tablist" aria-label="Admin sections">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" id={`atab-${k}`} aria-selected={tab === k} aria-controls="admin-body" onClick={() => setParams({ tab: k })}>{label}</button>
        ))}
      </div>
      <div id="admin-body" role="tabpanel" aria-labelledby={`atab-${tab}`}>
        {tab === 'people' && (data?.strict ? <AdminUsers /> : (
          <>
            <h1 tabIndex={-1}>People</h1>
            <p className="lead">Sign in with an admin account, or enter the admin key, to see who has signed up and what they did.</p>
            <p><Link className="btn btn-primary btn-sm" to="/login" state={{ from: '/admin' }}>Sign in</Link></p>
          </>
        ))}
        {tab === 'rules' && <AdminPanel signedIn={Boolean(data?.required && (getAdminKey() || data?.accountAdmin))} />}
      </div>
    </>
  );
}
