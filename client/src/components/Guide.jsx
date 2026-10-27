import ExternalLink from './ExternalLink.jsx';

// The full explanation for one checklist step, shown inside the site.
// All text comes from the rule record and its verified source. Nothing here decides applicability.
export default function Guide({ item }) {
  const g = item.guide;
  if (!g) return null;
  const hasExternal = (g.steps || []).some((s) => s.external);
  return (
    <details className="guide" data-testid={`guide-${item.id}`}>
      <summary>Guide: what it means, who it applies to, how to do it</summary>

      {item.after && <p className="hint">Comes after: {item.after}</p>}

      {g.pending && (
        <p className="pending-note" role="note"><strong>Not confirmed:</strong> {g.pendingNote}</p>
      )}

      <h4>What it means</h4>
      <p>{g.meaning}</p>
      {item.detail && <p>{item.detail}</p>}

      <h4>Who it applies to</h4>
      <ul>{(g.who || []).map((t) => <li key={t}>{t}</li>)}</ul>

      {g.conditions?.length > 0 && (
        <>
          <h4>Conditions and exceptions</h4>
          <ul>{g.conditions.map((t) => <li key={t}>{t}</li>)}</ul>
        </>
      )}

      <h4>What to prepare</h4>
      {g.prepare?.length > 0
        ? <ul>{g.prepare.map((t) => <li key={t}>{t}</li>)}</ul>
        : <p className="hint">{g.prepareNote || 'No verified preparation list yet.'}</p>}

      <h4>Steps</h4>
      <ol>
        {(g.steps || []).map((s) => (
          <li key={s.text}>{s.text}{s.external ? <span className="ext-tag"> (done on the agency site)</span> : null}</li>
        ))}
      </ol>

      {g.facts?.length > 0 && (
        <>
          <h4>Amounts and timing stated by the agency</h4>
          <p className="hint">These are the agency's own statements and estimates, not guaranteed dates. Fees, requirements and processing times can change. Confirm with the agency. The source is listed under Source details.</p>
          <ul>
            {g.facts.map((f) => (
              <li key={f.label} className={f.status === 'needs-verification' ? 'needs-verif' : undefined}>
                <strong>{f.label}:</strong>{' '}
                {f.status === 'needs-verification' && <span className="pill maybe">Needs verification</span>}{' '}
                {f.text}
                <span className="hint">
                  {' '}Checked {f.asOf}.
                  {f.source && f.source.url !== item.source?.url && (<> Source: <ExternalLink href={f.source.url}>{f.source.label}</ExternalLink>.</>)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {hasExternal && g.whyExternal && (
        <p className="why-ext"><strong>Why you leave this site:</strong> {g.whyExternal}</p>
      )}
    </details>
  );
}
