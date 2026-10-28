import ExternalLink from './ExternalLink.jsx';
import { useT } from '../i18n.js';

// The full explanation for one checklist step, shown inside the site.
// All text comes from the rule record and its verified source. Nothing here decides applicability.
export default function Guide({ item }) {
  const t = useT();
  const g = item.guide;
  if (!g) return null;
  const hasExternal = (g.steps || []).some((s) => s.external);
  return (
    <details className="guide" data-testid={`guide-${item.id}`}>
      <summary>{t('guide.summary')}</summary>

      {item.after && <p className="hint">{t('guide.after')}{item.after}</p>}

      {g.pending && (
        <p className="pending-note" role="note"><strong>{t('guide.notConfirmed')}</strong> {g.pendingNote}</p>
      )}

      <h4>{t('guide.means')}</h4>
      <p>{g.meaning}</p>
      {item.detail && <p>{item.detail}</p>}

      <h4>{t('guide.who')}</h4>
      <ul>{(g.who || []).map((t) => <li key={t}>{t}</li>)}</ul>

      {g.conditions?.length > 0 && (
        <>
          <h4>{t('guide.cond')}</h4>
          <ul>{g.conditions.map((t) => <li key={t}>{t}</li>)}</ul>
        </>
      )}

      <h4>{t('guide.prep')}</h4>
      {g.prepare?.length > 0
        ? <ul>{g.prepare.map((t) => <li key={t}>{t}</li>)}</ul>
        : <p className="hint">{g.prepareNote || t('guide.prepNone')}</p>}

      <h4>{t('gstep.title')}</h4>
      <ol>
        {(g.steps || []).map((s) => (
          <li key={s.text}>{s.text}{s.external ? <span className="ext-tag">{t('guide.ext')}</span> : null}</li>
        ))}
      </ol>

      {g.facts?.length > 0 && (
        <>
          <h4>{t('guide.facts')}</h4>
          <p className="hint">{t('guide.factsHint')}</p>
          <ul>
            {g.facts.map((f) => (
              <li key={f.label} className={f.status === 'needs-verification' ? 'needs-verif' : undefined}>
                <strong>{f.label}:</strong>{' '}
                {f.status === 'needs-verification' && <span className="pill maybe">{t('guide.needsVerif')}</span>}{' '}
                {f.text}
                <span className="hint">
                  {' '}{t('guide.checkedOn')}{f.asOf}.
                  {f.source && f.source.url !== item.source?.url && (<>{t('guide.source')}<ExternalLink href={f.source.url}>{f.source.label}</ExternalLink>.</>)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {hasExternal && g.whyExternal && (
        <p className="why-ext"><strong>{t('guide.whyExt')}</strong> {g.whyExternal}</p>
      )}
    </details>
  );
}
