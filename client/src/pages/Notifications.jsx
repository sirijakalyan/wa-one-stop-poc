import { useCallback, useState } from 'react';
import { api, useLoad } from '../api.js';
import { ErrorNote, Loading } from '../components/Parts.jsx';

export default function Notifications() {
  const fetchNotes = useCallback(() => api.notifications(), []);
  const { data, error, loading, reload } = useLoad(fetchNotes);
  const [actionError, setActionError] = useState('');
  const [info, setInfo] = useState('');
  const [email, setEmail] = useState('');

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

  if (loading && !data) return <Loading what="Loading notifications" />;
  if (error) return <ErrorNote message={error} />;

  const notes = data?.notifications ?? [];
  const mode = data?.emailMode ?? 'off'; // 'live' = delivered, 'log' = written to server log, 'off' = simulated only
  const real = mode !== 'off';
  const savedEmail = data?.email || '';
  const confirmed = Boolean(data?.emailConfirmed);
  const optedIn = Boolean(data?.emailOptIn);

  async function turnOn(e) {
    e.preventDefault();
    setActionError('');
    setInfo('');
    try {
      const r = await api.setEmailOptIn(true, email || savedEmail);
      setInfo(r.note || 'Saved.');
      await reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <>
      <h1 tabIndex={-1}>Simulated notifications</h1>
      <p className="lead">
        {mode === 'live' && 'Renewal reminders can be emailed to you if you choose. We only email after you confirm your address, and every email has an unsubscribe link.'}
        {mode === 'log' && 'Demo mode: emails are written to the server log and are not delivered to any inbox.'}
        {mode === 'off' && 'These show what renewal reminders and rule-change alerts would look like. No email or text message is ever sent.'}
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
              Email me when something changes (simulated)
              <small>In a real service email would be opt-in with an unsubscribe link. This demo sends nothing.</small>
            </span>
          </label>
        )}
        {real && !optedIn && (
          <form onSubmit={turnOn} className="email-form">
            <label htmlFor="reminder-email"><strong>Email me renewal reminders</strong> (optional)</label>
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
              <button type="submit" className="btn btn-primary btn-sm">Send confirmation</button>
            </div>
            <p className="hint">
              We use your address only to send renewal reminders. We email you a confirm link first. Each reminder has an
              unsubscribe link, and unsubscribing removes your address.
            </p>
          </form>
        )}
        {real && optedIn && (
          <div className="email-status" role="status">
            <p>
              <strong>{confirmed ? 'Reminders are on' : 'Waiting for your confirmation'}</strong>
              {' '}for {savedEmail}.{' '}
              {confirmed
                ? 'We email 30, 14, 7 and 1 days before a renewal date you enter on the Progress screen.'
                : 'Open the confirm link in the email we sent. Until then no reminders are sent.'}
            </p>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => run(() => api.setEmailOptIn(false), 'Email reminders are off and your address was removed.')}>
              Turn off and remove my email
            </button>
          </div>
        )}
        <div className="row spaced">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => run(() => api.renewalReminder(), real && confirmed ? 'Reminder created and emailed.' : 'Simulated renewal reminder created.')}
          >
            {real && confirmed ? 'Send me a reminder now' : 'Create a simulated renewal reminder'}
          </button>
        </div>
        <p className="hint">
          Reminders come from renewal dates you enter on the Progress screen. A rule-change alert appears after an
          admin publishes a change to a rule on your checklist.
        </p>
        <ErrorNote message={actionError} />
        {info && <p className="ok" role="status">{info}</p>}
      </div>

      <h2>Your notifications ({notes.length})</h2>
      {notes.length === 0 && <p className="hint">Nothing here yet.</p>}
      <ul className="notes">
        {notes.map((n) => (
          <li key={n.id} className={`note-item${n.read ? ' read' : ''}`}>
            <div className="item-top">
              <span className={`pill ${n.type === 'rule-changed' ? 'maybe' : 'agency'}`}>
                {n.type === 'rule-changed' ? 'Rule changed' : 'Renewal reminder'}
              </span>
              {n.simulated !== false && <span className="pill agency">Simulated</span>}
              <time className="hint" dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString()}</time>
            </div>
            <h3>{n.title}</h3>
            <p>{n.body}</p>
            {!n.read && (
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => run(() => api.markRead(n.id))}>
                Mark as read
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
