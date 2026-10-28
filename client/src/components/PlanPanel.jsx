import ExternalLink from './ExternalLink.jsx';

const shortDate = (iso) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : '');

// The plan builds as facts are confirmed. Every step keeps its status label and shows the answer that put it here.
export default function PlanPanel({ plan, newIds, onSimulate, simulating, busy }) {
  const items = plan?.items || [];
  return (
    <section className="plan-panel" aria-labelledby="plan-title">
      <h2 id="plan-title">Your plan <span className="biz-count">{items.length} {items.length === 1 ? 'step' : 'steps'}</span></h2>
      {!items.length ? (
        <p className="hint">Steps appear here as you confirm facts. Each one shows the answer that put it on your plan.</p>
      ) : (
        <ol className="plan-list" aria-live="polite">
          {items.map((i) => (
            <li key={i.id} className={`plan-item${newIds?.has(i.id) ? ' is-new' : ''}`}>
              <div className="plan-top">
                <strong>{i.title}</strong>
                <span className="plan-pills">
                  {i.status === 'applies' ? <span className="pill applies">Applies to you</span> : <span className="pill maybe">May apply, confirm</span>}
                  {i.verification === 'pending'
                    ? <span className="pill pending">Pending verification</span>
                    : <span className="pill source-checked" title="Someone read the official page and it supports this step. This is not an agency approval or a legal review.">Source checked{i.lastVerified ? ` ${shortDate(i.lastVerified)}` : ''}</span>}
                </span>
              </div>
              <p className="plan-agency">{i.agency}</p>
              <p className="plan-because"><span className="because">Because:</span> {i.trigger}</p>
              {i.source?.url ? <ExternalLink className="plan-source" href={i.source.url}>{i.source.label || 'Official source'}</ExternalLink> : null}
            </li>
          ))}
        </ol>
      )}
      {plan?.skipped?.length ? (
        <details className="plan-left-out">
          <summary>Left out of your plan ({plan.skipped.length})</summary>
          <ul className="facts-light">
            {plan.skipped.map((s) => <li key={s.ruleId}><strong>{s.title}.</strong> {s.reason}</li>)}
          </ul>
        </details>
      ) : null}
      {items.length ? (
        <div className="row spaced">
          <button type="button" className="btn btn-quiet btn-sm" onClick={onSimulate} disabled={busy || simulating}>
            Simulate a rule change
          </button>
          <span className="hint" style={{ margin: 0 }}>Public demo button. It changes no real rule.</span>
        </div>
      ) : null}
    </section>
  );
}
