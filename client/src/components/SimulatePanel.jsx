import { Link } from 'react-router-dom';
import ExternalLink from './ExternalLink.jsx';

const day = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric' });

// Shows one made-up source change: the old and new rule, the draft notice a person would approve, and the alert owners would get.
export default function SimulatePanel({ result, onClose }) {
  if (!result) return null;
  return (
    <section className="sim-panel" aria-labelledby="sim-title" role="region">
      <h2 id="sim-title" tabIndex={-1}>Rule change <span className="pill sim">Simulation</span></h2>
      <p className="hint">This is a made-up change to show how the system reacts. No real agency page changed and no stored rule was edited.</p>
      <p><strong>{result.rule.title}</strong>{result.rule.source?.url ? <> · <ExternalLink href={result.rule.source.url}>{result.rule.source.label || 'Source page'}</ExternalLink></> : null}</p>
      <div className="sim-compare">
        <div className="sim-col"><h3>Before</h3><p>{result.before.label}: {result.before.text}</p></div>
        <div className="sim-col is-after"><h3>After</h3><p>{result.after.label}: {result.after.text}</p></div>
      </div>
      <h3>Draft notice for a person to approve</h3>
      <blockquote className="sim-notice">{result.notice.text}</blockquote>
      <p className="hint">{result.notice.note}</p>
      {result.alert ? (
        <p className="ok" role="status">
          Alert created for owners with this step on their plan (simulated). <Link to="/notifications">See it in Notifications</Link>.
        </p>
      ) : (
        <p className="note">This step is not on your plan, so no alert was created.</p>
      )}
      {result.affected && result.timelineBefore?.estimate && result.timelineAfter?.estimate ? (
        <p className="sim-dates" data-testid="sim-dates">
          {result.timelineBefore.estimate.date === result.timelineAfter.estimate.date
            ? <>Your earliest estimate stays <strong>{day(result.timelineAfter.estimate.date)}</strong>, because another step on your plan already takes that long. The road below shows the updated step time.</>
            : <>Earliest estimate moved from <strong>{day(result.timelineBefore.estimate.date)}</strong> to <strong>{day(result.timelineAfter.estimate.date)}</strong>. The road below shows the updated version.</>}
        </p>
      ) : null}
      <button type="button" className="btn btn-quiet btn-sm" onClick={onClose}>End simulation and restore the real timeline</button>
    </section>
  );
}
