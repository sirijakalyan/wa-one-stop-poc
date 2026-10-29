import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';
import { useT } from '../i18n.js';
import Icon from './Icon.jsx';

// Header account area. Signed out: Sign in and Create account. Signed in: the person's initial, with a small menu.
export default function AccountMenu() {
  const t = useT();
  const { user, signOut } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!user) {
    return (
      <div className="acct-links">
        <Link className="btn btn-quiet btn-sm acct-in" to="/login">{t('auth.signIn')}</Link>
        <Link className="btn btn-primary btn-sm" to="/signup">{t('auth.signUp')}</Link>
      </div>
    );
  }
  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="acct" ref={ref}>
      <button type="button" className="acct-btn" aria-expanded={open} aria-haspopup="true" aria-label={`${t('auth.account')}: ${user.name}`} onClick={() => setOpen((o) => !o)}>
        <span className="acct-initial" aria-hidden="true">{initial}</span>
        <span className="acct-name">{user.name}</span>
        <Icon name="chevron" size={14} />
      </button>
      {open && (
        <div className="acct-pop" role="menu">
          <p className="acct-id"><strong>{user.name}</strong><span>{user.email}</span></p>
          {user.role === 'admin' && <Link role="menuitem" to="/admin" onClick={() => setOpen(false)}>{t('auth.admin')}</Link>}
          <button type="button" role="menuitem" onClick={async () => { setOpen(false); await signOut(); navigate('/'); }}>{t('auth.signOut')}</button>
        </div>
      )}
    </div>
  );
}
