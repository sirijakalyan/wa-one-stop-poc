import ExternalLink from './ExternalLink.jsx';
import { dateLocale, useT } from '../i18n.js';

const shortDate = (iso, lang) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(dateLocale(lang), { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : '');

// The plan builds as facts are confirmed. Every step keeps its status label and shows the answer that put it here.
export default function PlanPanel({ plan, newIds, onSimulate, simulating, busy }) {
  const t = useT();
  const items = plan?.items || [];
  return (
    <section className="plan-panel" aria-labelledby="plan-title">
      <h2 id="plan-title">{t('plan.title')} <span className="biz-count">{items.length} {items.length === 1 ? t('plan.step') : t('plan.steps')}</span></h2>
      {!items.length ? (
        <p className="hint">{t('plan.empty')}</p>
      ) : (
        <ol className="plan-list" aria-live="polite">
          {items.map((i) => (
            <li key={i.id} className={`plan-item${newIds?.has(i.id) ? ' is-new' : ''}`}>
              <div className="plan-top">
                <strong>{i.title}</strong>
                <span className="plan-pills">
                  {i.status === 'applies' ? <span className="pill applies">{t('pill.applies')}</span> : <span className="pill maybe">{t('pill.maybe')}</span>}
                  {i.verification === 'pending'
                    ? <span className="pill pending">{t('pill.pending')}</span>
                    : <span className="pill source-checked" title={t('plan.checkedTip')}>{t('pill.checked')}{i.lastVerified ? ` ${shortDate(i.lastVerified, t.lang)}` : ''}</span>}
                </span>
              </div>
              <p className="plan-agency">{i.agency}</p>
              <p className="plan-because"><span className="because">{t('plan.because')}</span> {i.trigger}</p>
              {i.source?.url ? <ExternalLink className="plan-source" href={i.source.url}>{i.source.label || t('plan.official')}</ExternalLink> : null}
            </li>
          ))}
        </ol>
      )}
      {plan?.skipped?.length ? (
        <details className="plan-left-out">
          <summary>{t('plan.left', plan.skipped.length)}</summary>
          <ul className="facts-light">
            {plan.skipped.map((s) => <li key={s.ruleId}><strong>{s.title}.</strong> {s.reason}</li>)}
          </ul>
        </details>
      ) : null}
      {items.length ? (
        <div className="row spaced">
          <button type="button" className="btn btn-quiet btn-sm" onClick={onSimulate} disabled={busy || simulating}>
            {t('plan.simulate')}
          </button>
          <span className="hint" style={{ margin: 0 }}>{t('plan.simHint')}</span>
        </div>
      ) : null}
    </section>
  );
}
