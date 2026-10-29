import { useCallback, useState } from 'react';
import ExternalLink from '../components/ExternalLink.jsx';
import { Simulated } from '../components/Parts.jsx';
import { Link } from 'react-router-dom';
import { api, useLoad } from '../api.js';
import { useT } from '../i18n.js';
import { ErrorNote, Loading, Meter } from '../components/Parts.jsx';


// The two blocks below are shared with the combined My business page, so both screens show the same numbers.
export function DashOverall({ data }) {
  const t = useT();
  return (
        <section className="panel" aria-labelledby="overall">
          <h2 id="overall">{t('pr.overall')}</h2>
          <p id="overall-text" className="big">{t('pr.done', data.done, data.total)}</p>
          <Meter percent={data.percent} labelledBy="overall-text" />
          <p className="hint">{t('pr.simTrack')}</p>
          <ul className="phase-list">
            {data.byPhase.map((p) => (
              <li key={p.phase}><span>{p.name}</span><span>{t('pr.of', p.done, p.total)}</span></li>
            ))}
          </ul>
        </section>
  );
}

export function DashNext({ data, className = 'panel', compact = false }) {
  const t = useT();
  return (
        <section className={className} aria-labelledby="next">
          <h2 id="next">{t('pr.next')}</h2>
          {data.next ? (
            <>
              <h3>{data.next.title}</h3>
              <p className="why">{data.next.reason}</p>
              <div className="row">
                {data.next.apply?.url && (
                  <ExternalLink className="btn btn-primary btn-sm" href={data.next.apply.url} fallback={data.next.fallback} showFallback>{data.next.apply.label}</ExternalLink>
                )}
                {!compact && <Link className="btn btn-quiet btn-sm" to="/my-business">{t('pr.openList')}</Link>}
              </div>
            </>
          ) : (
            <p>{t('pr.allDone')}</p>
          )}
          {!compact && (
            <p className="hint">
              <Link to="/notifications">{t('pr.notes')}</Link>
              {t('pr.unread', data.unread)}
            </p>
          )}
        </section>
  );
}

export function DashSummary({ data }) {
  return (
    <div className="dash-grid">
      <DashOverall data={data} />
      <DashNext data={data} />
    </div>
  );
}

export function DashRenewals({ data, onSave, savedId, actionError }) {
  const t = useT();
  return (
    <>
      <h2>{t('pr.renew')}</h2>
      <p className="hint">
        {t('pr.renewHint')}
      </p>
      <ErrorNote message={actionError} />
      <div className="table-scroll">
        <table className="stack">
          <thead>
            <tr><th scope="col">{t('pr.step')}</th><th scope="col">{t('pr.agency')}</th><th scope="col">{t('pr.renewDate')}</th></tr>
          </thead>
          <tbody>
            {data.items.map((i) => (
              <tr key={i.id}>
                <td>{i.title}{i.done && t('pr.stepDone')}</td>
                <td data-label={t('pr.agency')}>{i.agency}</td>
                <td data-label={t('pr.renewDate')}>
                  <label className="sr-only" htmlFor={`renew-${i.id}`}>{t('pr.renewFor', i.title)}</label>
                  <input
                    id={`renew-${i.id}`}
                    type="date"
                    className="date"
                    defaultValue={i.renewal || ''}
                    onBlur={(e) => { if ((e.target.value || '') !== (i.renewal || '')) onSave(i.id, e.target.value); }}
                  />
                  {savedId === i.id && <span className="saved">{t('pr.saved')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Dashboard() {
  const t = useT();
  const fetchDash = useCallback(() => api.dashboard(), [t.lang]); // eslint-disable-line react-hooks/exhaustive-deps
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

  if (loading && !data) return <Loading what={t('load.progress')} />;
  if (error) return <ErrorNote message={error} />;

  if (!data?.saved) {
    return (
      <div className="empty">
        <h1 tabIndex={-1}>{t('pr.title')} <Simulated /></h1>
        <p>{t('pr.empty')}</p>
        <div className="row">
          <Link className="btn btn-primary" to="/questionnaire">{t('cl.start')}</Link>
          <Link className="btn" to="/">{t('cl.pick')}</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 tabIndex={-1}>{t('pr.title')} <Simulated /></h1>
      <p className="hint">{data.label ? t('pr.sample', data.label) : ''}{t('pr.self')}</p>
      {t.lang === 'es' && <p className="draft-note">{t('enNote')}</p>}

      <DashSummary data={data} />

      <DashRenewals data={data} onSave={saveRenewal} savedId={savedId} actionError={actionError} />
    </>
  );
}
