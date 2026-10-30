import { Link } from 'react-router-dom';
import { useT } from '../i18n.js';
import { useApp } from '../AppContext.jsx';

export default function Footer() {
  const t = useT();
  const user = useApp()?.user;
  return (
    <footer>
      <div className="wrap">
        <p className="foot-disclaimer" data-testid="footer-disclaimer"><strong>{t('foot.short')}.</strong> {t('foot.text')}</p>
        <p>{t('foot.line')}</p>
        {(!user || user.role === 'admin') && <p className="foot-links"><Link to="/admin">{t('foot.admin')}</Link></p>}
      </div>
    </footer>
  );
}
