import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../routes.js';
import Icon from './Icon.jsx';
import NotificationBell from './NotificationBell.jsx';
import { useLang, useT } from '../i18n.js';
import { useApp } from '../AppContext.jsx';
import { useTheme } from '../theme.js';
import AccountMenu from './AccountMenu.jsx';

// Owner navigation only. On a phone the links sit behind a Menu button so the header stays one calm row.
export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { lang, setLang } = useLang();
  const t = useT();
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  const { user, requireLogin } = useApp();
  const isAdmin = user?.role === 'admin'; // admin accounts see the Admin area only
  const locked = isAdmin; // the site needs an account: signed-out visitors only see sign in and sign up
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="site-head">
      <div className="wrap">
        <Link to={isAdmin ? '/admin' : requireLogin ? '/home' : '/'} className="brand">
          <span className="brand-mark"><Icon name="shield" size={20} /></span>
          <span>WA Business One-Stop-Shop</span>
        </Link>
        <button type="button" className="menu-btn" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? 'close' : 'menu'} size={20} />
          <span>{open ? t('menu.close') : t('menu.open')}</span>
        </button>
        {!locked && <NotificationBell />}
        <button type="button" className="lang-btn" lang={lang === 'es' ? 'en' : 'es'} aria-label={t('lang.switchTo')} onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
          <Icon name="globe" size={18} />
          <span className="lang-full">{t('lang.button')}</span>
          <span className="lang-short" aria-hidden="true">{lang === 'es' ? 'EN' : 'ES'}</span>
        </button>
        <button type="button" className="theme-btn" role="switch" aria-checked={dark} aria-label={dark ? t('theme.toLight') : t('theme.toDark')} title={dark ? t('theme.toLight') : t('theme.toDark')} onClick={toggle}>
          <span className="theme-track" aria-hidden="true">
            <span className="theme-knob"><Icon name="bulb" size={16} /></span>
          </span>
          <span className="theme-label">{dark ? t('theme.dark') : t('theme.light')}</span>
        </button>
        <div className="head-auth"><AccountMenu /></div>
        <nav id="main-nav" aria-label="Main" className={open ? 'is-open' : ''}>
          <ul>
            {!locked && ROUTES.filter((r) => r.nav !== false).map((r) => (
              <li key={r.path}>
                <NavLink to={r.path === '/' && requireLogin ? '/home' : r.path} end={r.path === '/'}>
                  {t(`nav.${r.path}`) === `nav.${r.path}` ? r.label : t(`nav.${r.path}`)}
                </NavLink>
              </li>
            ))}
            {/* On a phone the account links live in the menu */}
            <li className="nav-auth">
              {user ? (
                <>
                  <span className="nav-who">{t('auth.signedAs', user.name)}</span>
                  {user.role === 'admin' && <NavLink to="/admin">{t('auth.admin')}</NavLink>}
                </>
              ) : (
                <>
                  <NavLink to="/login">{t('auth.signIn')}</NavLink>
                  <NavLink to="/signup">{t('auth.signUp')}</NavLink>
                </>
              )}
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
