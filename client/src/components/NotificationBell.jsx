import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { dateLocale, useT } from '../i18n.js';
import Icon from './Icon.jsx';

// Bell with a dropdown in the header. It reads the same notifications as the full Notifications page and marks
// them read through the same API call, so the two always agree. Nothing here is made up.
export default function NotificationBell() {
  const t = useT();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const wrap = useRef(null);

  const load = useCallback(async () => {
    try {
      setData(await api.notifications());
      setError('');
    } catch (e) {
      setError(e.message || 'error');
    }
  }, []);

  // Refresh the unread count whenever the owner moves to another screen, and each time the list opens.
  useEffect(() => { load(); }, [pathname, load]);
  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [open]);

  async function markRead(id) {
    try {
      await api.markRead(id);
      await load();
    } catch (e) {
      setError(e.message || 'error');
    }
  }

  const notes = data?.notifications ?? [];
  const unread = notes.filter((n) => !n.read).length;
  const shown = notes.slice(0, 5);

  return (
    <div className="bell" ref={wrap}>
      <button
        type="button"
        className="bell-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="bell-pop"
        aria-label={t('bell.label', unread)}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" size={20} />
        {unread > 0 && <span className="bell-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div id="bell-pop" className="bell-pop" role="region" aria-label={t('bell.title')}>
          <div className="bell-head">
            <strong>{t('bell.title')}</strong>
            <button type="button" className="bell-x" aria-label={t('bell.close')} onClick={() => setOpen(false)}><Icon name="close" size={18} /></button>
          </div>
          {!data && !error && <p className="hint" role="status">{t('bell.loading')}...</p>}
          {error && !data && <p className="err" role="alert">{t('bell.error')}</p>}
          {data && shown.length === 0 && <p className="hint">{t('bell.empty')}</p>}
          <ul className="bell-list">
            {shown.map((n) => (
              <li key={n.id} className={n.read ? 'read' : ''}>
                <div className="bell-top">
                  <span className={`pill ${n.type === 'rule-changed' ? 'maybe' : 'agency'}`}>{n.type === 'rule-changed' ? t('nt.ruleChanged') : t('nt.renewal')}</span>
                  {n.simulated !== false && <span className="pill agency">{t('pill.simulated')}</span>}
                </div>
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                <time className="hint" dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString(dateLocale(t.lang))}</time>
                {!n.read && <button type="button" className="linklike" onClick={() => markRead(n.id)}>{t('bell.markRead')}</button>}
              </li>
            ))}
          </ul>
          <Link className="bell-all" to="/notifications">{t('bell.viewAll')}</Link>
        </div>
      )}
    </div>
  );
}
