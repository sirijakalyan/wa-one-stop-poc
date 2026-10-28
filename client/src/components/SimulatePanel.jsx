import { Link } from 'react-router-dom';
import ExternalLink from './ExternalLink.jsx';
import { dateLocale, useT } from '../i18n.js';

const day = (iso, lang) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(dateLocale(lang), { timeZone: 'UTC', month: 'long', day: 'numeric' });

// Shows one made-up source change: the old and new rule, the draft notice a person would approve, and the alert owners would get.
export default function SimulatePanel({ result, onClose }) {
  const t = useT();
  if (!result) return null;
  return (
    <section className="sim-panel" aria-labelledby="sim-title" role="region">
      <h2 id="sim-title" tabIndex={-1}>{t('sim.title')} <span className="pill sim">{t('pill.simulation')}</span></h2>
      <p className="hint">{t('sim.hint')}</p>
      <p><strong>{result.rule.title}</strong>{result.rule.source?.url ? <> · <ExternalLink href={result.rule.source.url}>{result.rule.source.label || t('sim.sourcePage')}</ExternalLink></> : null}</p>
      <div className="sim-compare">
        <div className="sim-col"><h3>{t('sim.before')}</h3><p>{result.before.label}: {result.before.text}</p></div>
        <div className="sim-col is-after"><h3>{t('sim.after')}</h3><p>{result.after.label}: {result.after.text}</p></div>
      </div>
      <h3>{t('sim.draft')}</h3>
      <blockquote className="sim-notice">{result.notice.text}</blockquote>
      <p className="hint">{result.notice.note}</p>
      {result.alert ? (
        <p className="ok" role="status">
          {t('sim.alert')}<Link to="/notifications">{t('sim.see')}</Link>.
        </p>
      ) : (
        <p className="note">{t('sim.noAlert')}</p>
      )}
      {result.affected && result.timelineBefore?.estimate && result.timelineAfter?.estimate ? (
        <p className="sim-dates" data-testid="sim-dates">
          {result.timelineBefore.estimate.date === result.timelineAfter.estimate.date
            ? t('sim.same', day(result.timelineAfter.estimate.date, t.lang))
            : t('sim.moved', day(result.timelineBefore.estimate.date, t.lang), day(result.timelineAfter.estimate.date, t.lang))}
        </p>
      ) : null}
      <button type="button" className="btn btn-quiet btn-sm" onClick={onClose}>{t('sim.end')}</button>
    </section>
  );
}
