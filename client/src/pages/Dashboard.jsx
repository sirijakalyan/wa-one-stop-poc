import { useCallback, useState } from 'react';
import ExternalLink from '../components/ExternalLink.jsx';
import { Simulated } from '../components/Parts.jsx';
import { Link } from 'react-router-dom';
import { api, useLoad } from '../api.js';
import { ErrorNote, Loading, Meter } from '../components/Parts.jsx';

export default function Dashboard() {
  const fetchDash = useCallback(() => api.dashboard(), []);
  const { data, error, loading, reload } = useLoad(fetchDash);
  const [actionError, setActionError] = useState('');
  const [savedId, setSavedId] = useState('');

  async function saveRenewal(ruleId, date) {
    setActionError('');
    try {
      await api.setRenewal(ruleId, date || null);
      setSavedId(ruleId);
      await reload();
    } catch (e) {
      setActionError(e.message);
    }
  }

  if (loading && !data) return <Loading what="Loading your progress" />;
  if (error) return <ErrorNote message={error} />;

  if (!data?.saved) {
    return (
      <div className="empty">
        <h1 tabIndex={-1}>Your progress <Simulated /></h1>
        <p>Build a checklist first. Your progress appears here.</p>
        <div className="row">
          <Link className="btn btn-primary" to="/questionnaire">Start the questionnaire</Link>
          <Link className="btn" to="/">Pick a sample</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 tabIndex={-1}>Your progress <Simulated /></h1>
      <p className="hint">{data.label ? `Sample: ${data.label}. ` : ''}Status is self-reported in this demo. No agency system is connected.</p>

      <div className="dash-grid">
        <section className="panel" aria-labelledby="overall">
          <h2 id="overall">Overall</h2>
          <p id="overall-text" className="big">{data.done} of {data.total} steps done</p>
          <Meter percent={data.percent} labelledBy="overall-text" />
          <p className="hint">Simulated tracking. This count comes from steps you tick yourself. No agency status is connected.</p>
          <ul className="phase-list">
            {data.byPhase.map((p) => (
              <li key={p.phase}><span>{p.name}</span><span>{p.done} of {p.total}</span></li>
            ))}
          </ul>
        </section>

        <section className="panel" aria-labelledby="next">
          <h2 id="next">Your next step</h2>
          {data.next ? (
            <>
              <h3>{data.next.title}</h3>
              <p className="why">{data.next.reason}</p>
              <div className="row">
                {data.next.apply?.url && (
                  <ExternalLink className="btn btn-primary btn-sm" href={data.next.apply.url} fallback={data.next.fallback} showFallback>{data.next.apply.label}</ExternalLink>
                )}
                <Link className="btn btn-quiet btn-sm" to="/checklist">Open checklist</Link>
              </div>
            </>
          ) : (
            <p>Every step is marked done. Keep each agency's own confirmation for your records.</p>
          )}
          <p className="hint">
            <Link to="/notifications">Notifications</Link>
            {data.unread > 0 ? `: ${data.unread} unread` : ': none unread'}
          </p>
        </section>
      </div>

      <h2>Renewal dates</h2>
      <p className="hint">
        Enter the renewal date an agency gave you. The demo stores it and can create a simulated reminder.
        It does not know any renewal period and will not guess one.
      </p>
      <ErrorNote message={actionError} />
      <div className="table-scroll">
        <table className="stack">
          <thead>
            <tr><th scope="col">Step</th><th scope="col">Agency</th><th scope="col">Renewal date</th></tr>
          </thead>
          <tbody>
            {data.items.map((i) => (
              <tr key={i.id}>
                <td>{i.title}{i.done && ' (done)'}</td>
                <td data-label="Agency">{i.agency}</td>
                <td data-label="Renewal date">
                  <label className="sr-only" htmlFor={`renew-${i.id}`}>Renewal date for {i.title}</label>
                  <input
                    id={`renew-${i.id}`}
                    type="date"
                    className="date"
                    defaultValue={i.renewal || ''}
                    onBlur={(e) => { if ((e.target.value || '') !== (i.renewal || '')) saveRenewal(i.id, e.target.value); }}
                  />
                  {savedId === i.id && <span className="saved"> Saved</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
