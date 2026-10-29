import { useCallback, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Link } from 'react-router-dom';
import { api, useLoad } from '../api.js';
import { useT } from '../i18n.js';
import Checklist from './Checklist.jsx';
import { DashNext, DashOverall, DashRenewals } from './Dashboard.jsx';
import { ErrorNote, Loading, Simulated } from '../components/Parts.jsx';

// One page for the saved checklist and the progress. It reuses the Checklist and Dashboard pieces and the same
// API calls, so marking a step done saves exactly as before and the summary above refreshes from the server.
export default function MyBusiness() {
  const t = useT();
  const fetchDash = useCallback(() => api.dashboard(), [t.lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, error, loading, reload } = useLoad(fetchDash);
  const [cl, setCl] = useState(null); // the checklist the Checklist piece loaded, used for the status counts
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
        <h1 tabIndex={-1}>{t('mb.title')} <Simulated /></h1>
        <p>{t('mb.empty')}</p>
        <div className="row">
          <Link className="btn btn-primary" to="/">{t('mb.startHome')}</Link>
        </div>
      </div>
    );
  }

  const items = cl?.items || [];
  const pending = items.filter((i) => i.verification?.status === 'pending').length;
  const remaining = Math.max(0, data.total - data.done);

  return (
    <>
      <header className="mb-banner">
        <div>
          <h1 tabIndex={-1}>{t('mb.title')} <Simulated /></h1>
          <p className="mb-status">{data.label ? t('pr.sample', data.label) : ''}{t('pr.self')}</p>
          {t.lang === 'es' && <p className="draft-note">{t('enNote')}</p>}
        </div>
        <div className="ring" style={{ '--p': data.percent }} role="img" aria-label={`${data.percent}% ${t('mb.complete')}`}>
          <span><strong>{data.percent}%</strong><small>{t('mb.complete')}</small></span>
        </div>
      </header>

      <div className="mb-split">
        <div className="mb-main">
          <DashNext data={data} className="next-card" />
          <Checklist embedded onChanged={reload} onData={setCl} />
          <DashRenewals data={data} onSave={saveRenewal} savedId={savedId} actionError={actionError} />
        </div>
        <aside className="mb-side" aria-label={t('mb.stats')}>
          <ul className="stat-row">
            <li className="st-done"><Icon name="checkCircle" size={20} /><strong>{data.done}</strong><span>{t('mb.doneN')}</span></li>
            <li className="st-left"><Icon name="list" size={20} /><strong>{remaining}</strong><span>{t('mb.remaining')}</span></li>
            <li className="st-pend"><Icon name="clock" size={20} /><strong>{cl ? pending : '-'}</strong><span>{t('mb.pendingV')}</span></li>
            <li className="st-pct"><Icon name="shield" size={20} /><strong>{data.percent}%</strong><span>{t('mb.complete')}</span></li>
          </ul>
          <p className="hint" data-testid="mb-steps">{t('cl.steps', data.done, data.total)}</p>
          <DashOverall data={data} />
        </aside>
      </div>
    </>
  );
}
