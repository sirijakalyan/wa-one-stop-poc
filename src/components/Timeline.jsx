import Icon from './Icon.jsx';
import { dateLocale, useT } from '../i18n.js';

const fmt = (iso, lang) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(dateLocale(lang), { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
const fmtShort = (iso, lang) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(dateLocale(lang), { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : '');

// Road to opening day. Steps by phase. A time appears only when the agency published one and our records show it;
// every other step says "time not published". The date at the end is an estimate and only appears once the card is complete.
export default function Timeline({ timeline, simulated = false }) {
  const t = useT();
  if (!timeline || !timeline.phases.length) {
    return (
      <section className="timeline panel-lite" aria-labelledby="road-title">
        <h2 id="road-title" tabIndex={-1}>{t('road.title')}</h2>
        <p className="hint">{t('road.empty')}</p>
      </section>
    );
  }
  return (
    <section className={`timeline panel-lite${simulated ? ' is-simulated' : ''}`} aria-labelledby="road-title">
      <h2 id="road-title" tabIndex={-1}>{t('road.title')}{simulated ? <span className="pill sim">{t('pill.simulation')}</span> : null}</h2>
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
                    <span className="road-time none">{t('road.none')}</span>
                  )}
                  {s.time?.note ? <span className="road-note">{s.time.note}</span> : null}
                  {s.verification === 'pending' ? <span className="pill pending">{t('pill.pending')}</span> : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
        <li className="road-phase road-end">
          <h3><span className="road-num"><Icon name="checkCircle" size={16} /></span>{t('road.open')}</h3>
          {timeline.estimate ? (
            <div data-testid="estimate">
              <p className="road-date">{t('road.est')}{fmt(timeline.estimate.date, t.lang)}</p>
              <p className="hint">{timeline.estimate.note}</p>
              <details>
                <summary>{t('road.counts')}</summary>
                <ul className="facts-light">
                  {timeline.estimate.basedOn.map((b) => <li key={b.id}>{b.title}: {b.text}</li>)}
                </ul>
                {timeline.estimate.noPublishedTime.length ? (
                  <p className="hint">{t('road.noPub')}{timeline.estimate.noPublishedTime.join('; ')}.</p>
                ) : null}
              </details>
            </div>
          ) : (
            <p className="hint" data-testid="no-estimate">
              {timeline.pending
                ? t('road.pendingEst')
                : t('road.noEst')}
            </p>
          )}
        </li>
      </ol>
      {timeline.retrievedOn ? (
        <p className="hint road-source">{t('road.source', fmtShort(timeline.retrievedOn, t.lang))}</p>
      ) : null}
    </section>
  );
}
