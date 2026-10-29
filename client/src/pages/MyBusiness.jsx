import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { api, getBusiness, setBusiness, stopEditing, useLoad } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { blankCard } from '../guideCard.js';
import { useT } from '../i18n.js';
import Checklist from './Checklist.jsx';
import { DashOverall, DashRenewals } from './Dashboard.jsx';
import { ErrorNote, Loading, Simulated } from '../components/Parts.jsx';

// One page for the saved checklist and the progress. It reuses the Checklist and Dashboard pieces and the same
// API calls, so marking a step done saves exactly as before and the summary above refreshes from the server.
export default function MyBusiness() {
  const t = useT();
  const navigate = useNavigate();
  const { setGuide } = useApp();
  const [biz, setBiz] = useState(getBusiness());
  const fetchList = useCallback(() => api.businesses(), []);
  const { data: list, reload: reloadList } = useLoad(fetchList);
  const fetchDash = useCallback(() => api.dashboard(), [t.lang, biz]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, error, loading, reload } = useLoad(fetchDash);
  const businesses = list?.businesses || [];
  // The business last looked at may have been removed (or belong to another account): fall back to the first one saved.
  useEffect(() => {
    if (businesses.length && !businesses.some((b) => b.id === biz)) pick(businesses[0].id);
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps
  function pick(id) {
    setBusiness(id);
    stopEditing();
    setBiz(id);
  }
  function addBusiness() {
    stopEditing();
    setGuide({ messages: [], card: blankCard(), ask: null, awaiting: null, complete: false });
    navigate('/', { state: { mode: 'type' } });
  }
  const [cl, setCl] = useState(null); // the checklist the Checklist piece loaded, used for the status counts
  const [actionError, setActionError] = useState('');
  const [savedId, setSavedId] = useState('');

  async function saveRenewal(ruleId, date) {
    setActionError('');
    try {
      await api.setRenewal(ruleId, date || null);
      setSavedId(ruleId);
      await reload();
      reloadList();
    } catch (e) {
      setActionError(e.message);
    }
  }

  const switcher = businesses.length > 0 && (
    <nav className="biz-switch" aria-label={t('mb.yours')}>
      <h2 className="biz-switch-title">{t('mb.yours')}</h2>
      <ul>
        {businesses.map((b) => (
          <li key={b.id}>
            <button type="button" className={`biz-pick${b.id === biz ? ' is-on' : ''}`} aria-current={b.id === biz ? 'true' : undefined} onClick={() => pick(b.id)} aria-label={t('mb.pick', b.label || t('mb.title'), b.percent)}>
              <strong>{b.label || t('mb.title')}</strong>
              <span>{b.done} / {b.total}</span>
            </button>
          </li>
        ))}
        <li><button type="button" className="biz-add" onClick={addBusiness}><Icon name="plus" size={16} /> {t('mb.add')}</button></li>
      </ul>
    </nav>
  );

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
      {switcher}
      <header className="mb-banner">
        <div>
          <h1 tabIndex={-1}>{t('mb.title')} <Simulated /></h1>
          <p className="mb-status">{data.label ? t('pr.sample', data.label) : ''}{t('pr.self')}</p>
          {t.lang === 'es' && <p className="draft-note">{t('enNote')}</p>}
          <a className="mb-jump" href="#renewals" onClick={(e) => { e.preventDefault(); document.getElementById('renewals')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            <Icon name="calendar" size={16} /> {t('pr.renewJump')}
          </a>
        </div>
        <div className="ring" style={{ '--p': data.percent }} role="img" aria-label={`${data.percent}% ${t('mb.complete')}`}>
          <span><strong>{data.percent}%</strong><small>{t('mb.complete')}</small></span>
        </div>
      </header>

      <div className="mb-split">
        <div className="mb-main">
          <Checklist key={biz} embedded onChanged={() => { reload(); reloadList(); }} onData={setCl} />
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
