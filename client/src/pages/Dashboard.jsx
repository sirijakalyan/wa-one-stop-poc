import { useCallback, useEffect, useRef, useState } from 'react';
import ExternalLink from '../components/ExternalLink.jsx';
import { Simulated } from '../components/Parts.jsx';
import { Link } from 'react-router-dom';
import { api, useLoad } from '../api.js';
import { useT } from '../i18n.js';
import Icon from '../components/Icon.jsx';
import { buildIcs, downloadIcs, fileSafe, googleUrl } from '../calendar.js';
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

// A date is saved only when the owner presses Save (or Enter). Picking or typing a date just prepares it, and the Save button
// lights up. Only a sensible year (2000 to 2100) can be saved, so a half-typed year like 0002 is never stored.
const sensible = (v) => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000 && Number(v.slice(0, 4)) <= 2100);

export function RenewalInput({ id, value, onSave }) {
  const t = useT();
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]); // a saved date coming back from the server is the new starting point
  const changed = draft !== value;
  const ok = sensible(draft);
  const submit = (e) => { e.preventDefault(); if (changed && ok) onSave(draft); };
  return (
    <>
      <form className="renew-form" onSubmit={submit}>
        <input id={id} type="date" className="date" value={draft} onChange={(e) => setDraft(e.target.value)} />
        {changed && (
          <button type="submit" className="btn btn-primary btn-sm renew-save" disabled={!ok}>
            <Icon name="check" size={16} /> {t('pr.saveDate')}
          </button>
        )}
      </form>
      {changed && ok && <p className="hint renew-unsaved" role="status">{t('pr.unsaved')}</p>}
    </>
  );
}

const eventOf = (i, t) => ({
  id: i.id,
  date: i.renewal,
  title: t('cal.title', i.title),
  description: t('cal.desc', i.agency, `${window.location.origin}/my-business`, i.apply?.url || i.source?.url || ''),
  url: `${window.location.origin}/my-business`,
});

export function DashRenewals({ data, onSave, savedId, actionError }) {
  const t = useT();
  const set = data.items.filter((i) => i.renewal).length;
  const dated = data.items.filter((i) => i.renewal);
  const saveFile = (list, name) => downloadIcs(`${fileSafe(name)}.ics`, buildIcs(list.map((i) => eventOf(i, t)), { alarmText: t('cal.alarm') }));
  return (
    <section className="renewals-card" id="renewals" aria-labelledby="renewals-title">
      <header className="renewals-head">
        <span className="renewals-icon" aria-hidden="true"><Icon name="calendar" size={22} /></span>
        <div>
          <h2 id="renewals-title">{t('pr.renew')} <span className="chip-count" data-testid="renewals-count">{t('pr.renewSet', set, data.items.length)}</span></h2>
          <p className="hint">{t('pr.renewHint')}</p>
        </div>
      </header>
      <ErrorNote message={actionError} />
      <div className="table-scroll">
        <table className="stack">
          <thead>
            <tr><th scope="col">{t('pr.step')}</th><th scope="col">{t('pr.agency')}</th><th scope="col">{t('pr.renewDate')}</th><th scope="col">{t('cal.col')}</th></tr>
          </thead>
          <tbody>
            {data.items.map((i) => (
              <tr key={i.id}>
                <td>{i.title}{i.done && t('pr.stepDone')}</td>
                <td data-label={t('pr.agency')}>{i.agency}</td>
                <td data-label={t('pr.renewDate')}>
                  <label className="sr-only" htmlFor={`renew-${i.id}`}>{t('pr.renewFor', i.title)}</label>
                  <RenewalInput id={`renew-${i.id}`} value={i.renewal || ''} onSave={(v) => onSave(i.id, v)} />
                  {savedId === i.id && <span className="saved">{t('pr.saved')}</span>}
                </td>
                <td data-label={t('cal.col')}>
                  {i.renewal ? (
                    <span className="cal-actions">
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => saveFile([i], i.title)} aria-label={t('cal.addFor', i.title)}>{t('cal.add')}</button>
                      <a className="btn btn-quiet btn-sm" href={googleUrl(eventOf(i, t))} target="_blank" rel="noopener noreferrer" aria-label={t('cal.googleFor', i.title)}>{t('cal.google')}</a>
                    </span>
                  ) : <span className="hint">{t('cal.needDate')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cal-all">
        <button type="button" className="btn btn-primary btn-sm" disabled={!dated.length} onClick={() => saveFile(dated, `${data.label || 'Business'} renewals`)}>{t('cal.all')}</button>
        <p className="hint">{t('cal.hint')}</p>
      </div>
    </section>
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
