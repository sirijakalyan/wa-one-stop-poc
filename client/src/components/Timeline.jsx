import Icon from './Icon.jsx';

const fmt = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
const fmtShort = (iso) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : '');

// Road to opening day. Steps by phase. A time appears only when the agency published one and our records show it;
// every other step says "time not published". The date at the end is an estimate and only appears once the card is complete.
export default function Timeline({ timeline, simulated = false }) {
  if (!timeline || !timeline.phases.length) {
    return (
      <section className="timeline panel-lite" aria-labelledby="road-title">
        <h2 id="road-title" tabIndex={-1}>Road to opening day</h2>
        <p className="hint">The road fills in as steps join your plan. Confirm your answers and the phases appear here.</p>
      </section>
    );
  }
  return (
    <section className={`timeline panel-lite${simulated ? ' is-simulated' : ''}`} aria-labelledby="road-title">
      <h2 id="road-title" tabIndex={-1}>Road to opening day{simulated ? <span className="pill sim">Simulation</span> : null}</h2>
      <ol className="road">
        {timeline.phases.map((p) => (
          <li key={p.phase} className="road-phase">
            <h3><span className="road-num">{p.phase}</span>{p.name}</h3>
            <ul>
              {p.steps.map((s) => (
                <li key={s.id} className="road-step">
                  <span className="road-title">{s.title}</span>
                  <span className="road-agency">{s.agency}</span>
                  {s.time ? (
                    <span className="road-time"><Icon name="clock" size={14} /> {s.time.label}: {s.time.text}</span>
                  ) : (
                    <span className="road-time none">Time not published</span>
                  )}
                  {s.time?.note ? <span className="road-note">{s.time.note}</span> : null}
                  {s.verification === 'pending' ? <span className="pill pending">Pending verification</span> : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
        <li className="road-phase road-end">
          <h3><span className="road-num"><Icon name="checkCircle" size={16} /></span>Open</h3>
          {timeline.estimate ? (
            <div data-testid="estimate">
              <p className="road-date">Earliest estimate: {fmt(timeline.estimate.date)}</p>
              <p className="hint">{timeline.estimate.note}</p>
              <details>
                <summary>What this counts</summary>
                <ul className="facts-light">
                  {timeline.estimate.basedOn.map((b) => <li key={b.id}>{b.title}: {b.text}</li>)}
                </ul>
                {timeline.estimate.noPublishedTime.length ? (
                  <p className="hint">No published time, so not counted: {timeline.estimate.noPublishedTime.join('; ')}.</p>
                ) : null}
              </details>
            </div>
          ) : (
            <p className="hint" data-testid="no-estimate">
              {timeline.pending
                ? 'Your estimated opening date appears once every row on your business card is confirmed.'
                : 'None of your steps has a published processing time in our records, so we cannot estimate a date.'}
            </p>
          )}
        </li>
      </ol>
      {timeline.retrievedOn ? (
        <p className="hint road-source">Times come from agency pages read on {fmtShort(timeline.retrievedOn)}. They are the agencies&apos; own estimates, not promises. Confirm with each agency.</p>
      ) : null}
    </section>
  );
}
