import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../routes.js';
import Icon from './Icon.jsx';
import NotificationBell from './NotificationBell.jsx';
import { useLang, useT } from '../i18n.js';

// Owner navigation only. On a phone the links sit behind a Menu button so the header stays one calm row.
export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { lang, setLang } = useLang();
  const t = useT();
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
        <Link to="/" className="brand">
          <span className="brand-mark"><Icon name="shield" size={20} /></span>
          <span>WA Business One-Stop-Shop</span>
        </Link>
        <button type="button" className="menu-btn" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? 'close' : 'menu'} size={20} />
          <span>{open ? t('menu.close') : t('menu.open')}</span>
        </button>
        <NotificationBell />
        <button type="button" className="lang-btn" lang={lang === 'es' ? 'en' : 'es'} aria-label={t('lang.switchTo')} onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
          <Icon name="globe" size={18} />
          <span className="lang-full">{t('lang.button')}</span>
          <span className="lang-short" aria-hidden="true">{lang === 'es' ? 'EN' : 'ES'}</span>
        </button>
        <nav id="main-nav" aria-label="Main" className={open ? 'is-open' : ''}>
          <ul>
            {ROUTES.filter((r) => r.nav !== false).map((r) => (
              <li key={r.path}>
                <NavLink to={r.path} end={r.path === '/'}>
                  {t(`nav.${r.path}`) === `nav.${r.path}` ? r.label : t(`nav.${r.path}`)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
