import { useCallback, useEffect, useState } from 'react';
import { api, useLoad } from '../api.js';
import { dateLocale, useT } from '../i18n.js';
import { ErrorNote, Loading } from '../components/Parts.jsx';

// embedded: the same screen shown inside the header bell. onData reports the loaded list so the bell can show the unread count.
export default function Notifications({ embedded = false, onData } = {}) {
  const t = useT();
  const fetchNotes = useCallback(() => api.notifications(), []);
  const { data, error, loading, reload } = useLoad(fetchNotes);
  const [actionError, setActionError] = useState('');
  const [info, setInfo] = useState('');
  const [email, setEmail] = useState('');
  useEffect(() => { if (data) onData?.(data); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn, message) {
    setActionError('');
    setInfo('');
    try {
      await fn();
      if (message) setInfo(message);
      await reload();
    } catch (e) {
      setActionError(e.message);
    }
  }

  if (loading && !data) return <Loading what={t('load.notes')} />;
  if (error) return <ErrorNote message={error} />;

  const notes = data?.notifications ?? [];
  const mode = data?.emailMode ?? 'off'; // 'live' = delivered, 'log' = written to server log, 'off' = simulated only
  const real = mode !== 'off';
  const savedEmail = data?.email || '';
  const confirmed = Boolean(data?.emailConfirmed);
  const optedIn = Boolean(data?.emailOptIn);
  const acctEmail = data?.accountEmail || ''; // signed in: reminders use this address, no form

  async function turnOn(e) {
    e.preventDefault();
    setActionError('');
    setInfo('');
    try {
      const r = await api.setEmailOptIn(true, email || savedEmail);
      setInfo(t.lang === 'es' ? t('nt.saved') : (r.note || t('nt.saved')));
      await reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <>
      {!embedded && <h1 tabIndex={-1}>{t('nt.title')}</h1>}
      {t.lang === 'es' && <p className="draft-note">{t('nt.note')}</p>}
      {acctEmail ? (
        <div className="panel acct-notes">
          {mode === 'log' && <p className="hint">{t('nt.log')}</p>}
          {mode === 'off' && <p className="hint">{t('nt.off')}</p>}
          {real && (
            <p className="email-status" role="status">
              {optedIn ? t('nt.acctOn', acctEmail) : t('nt.acctOff')}{' '}
              <button type="button" className="linklike" onClick={() => run(() => api.setEmailOptIn(!optedIn))}>
                {optedIn ? t('nt.acctStop') : t('nt.acctStart')}
              </button>
            </p>
          )}
          <p className="hint">{t('nt.fromRenewals')}</p>
          <ErrorNote message={actionError} />
          {info && <p className="ok" role="status">{info}</p>}
        </div>
      ) : (<>
      <p className={embedded ? 'hint' : 'lead'}>
        {mode === 'live' && t('nt.live')}
        {mode === 'log' && t('nt.log')}
        {mode === 'off' && t('nt.off')}
      </p>

      <div className="panel">
        {!real && (
          <label className="opt toggle">
            <input
              type="checkbox"
              checked={optedIn}
              onChange={(e) => run(() => api.setEmailOptIn(e.target.checked))}
            />
            <span>
              {t('nt.emailMe')}
              <small>{t('nt.emailMeSmall')}</small>
            </span>
          </label>
        )}
        {real && !optedIn && (
          <form onSubmit={turnOn} className="email-form">
            <label htmlFor="reminder-email"><strong>{t('nt.emailReminders')}</strong>{t('nt.optional')}</label>
            <div className="row">
              <input
                id="reminder-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary btn-sm">{t('nt.sendConfirm')}</button>
            </div>
            <p className="hint">
              {t('nt.emailHint')}
            </p>
          </form>
        )}
        {real && optedIn && (
          <div className="email-status" role="status">
            <p>
              <strong>{confirmed ? t('nt.on') : t('nt.waiting')}</strong>
              {t('nt.for', savedEmail)}
              {confirmed ? t('nt.onText') : t('nt.waitText')}
            </p>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => run(() => api.setEmailOptIn(false), t('nt.removed'))}>
              {t('nt.turnOff')}
            </button>
          </div>
        )}
        <div className="row spaced">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => run(() => api.renewalReminder(), real && confirmed ? t('nt.sentNow') : t('nt.simCreated'))}
          >
            {real && confirmed ? t('nt.sendNow') : t('nt.createSim')}
          </button>
        </div>
        <p className="hint">
          {t('nt.fromRenewals')}
        </p>
        <ErrorNote message={actionError} />
        {info && <p className="ok" role="status">{info}</p>}
      </div>
      </>)}

      <h2>{t('nt.yours', notes.length)}</h2>
      {notes.length === 0 && <p className="hint">{t('nt.nothing')}</p>}
      <ul className="notes">
        {notes.map((n) => (
          <li key={n.id} className={`note-item${n.read ? ' read' : ''}`}>
            <div className="item-top">
              <span className={`pill ${n.type === 'rule-changed' ? 'maybe' : 'agency'}`}>
                {n.type === 'rule-changed' ? t('nt.ruleChanged') : t('nt.renewal')}
              </span>
              {n.simulated !== false && <span className="pill agency">{t('pill.simulated')}</span>}
              <time className="hint" dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString(dateLocale(t.lang))}</time>
            </div>
            <h3>{n.title}</h3>
            <p>{n.body}</p>
            {!n.read && (
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => run(() => api.markRead(n.id))}>
                {t('nt.markRead')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
