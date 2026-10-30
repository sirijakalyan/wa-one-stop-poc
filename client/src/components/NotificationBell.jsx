import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Notifications from '../pages/Notifications.jsx';
import { api } from '../api.js';
import { useT } from '../i18n.js';
import Icon from './Icon.jsx';

// Bell with a dropdown in the header. It reads the same notifications as the full Notifications page and marks
// them read through the same API call, so the two always agree. Nothing here is made up.
export default function NotificationBell() {
  const t = useT();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const wrap = useRef(null);

  const load = useCallback(async () => {
    try {
      setData(await api.notifications());
    } catch {
      /* keep the last count */
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

  const notes = data?.notifications ?? [];
  const unread = notes.filter((n) => !n.read).length;

  return (
    <div className="bell" ref={wrap}>
      <button
        type="button"
        className="bell-btn"
        aria-expanded={open}
        aria-controls={open ? 'bell-pop' : undefined}
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
          <Notifications embedded onData={setData} />
        </div>
      )}
    </div>
  );
}
