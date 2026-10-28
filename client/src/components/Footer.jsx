import { Link } from 'react-router-dom';
import { useT } from '../i18n.js';

export default function Footer() {
  const t = useT();
  return (
    <footer>
      <div className="wrap">
        <p className="foot-disclaimer" data-testid="footer-disclaimer"><strong>{t('foot.short')}.</strong> {t('foot.text')}</p>
        <p>{t('foot.line')}</p>
        <p className="foot-links"><Link to="/sources">{t('foot.sources')}</Link><span aria-hidden="true"> · </span><Link to="/admin">{t('foot.admin')}</Link></p>
      </div>
    </footer>
  );
}
