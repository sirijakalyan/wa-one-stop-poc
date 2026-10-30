import { Link } from 'react-router-dom';
import { useT } from '../i18n.js';
import { useApp } from '../AppContext.jsx';

export default function Footer() {
  const t = useT();
  const { user, requireLogin } = useApp() || {};
  // Only admins (or the open preview, which has no accounts) get the Admin link.
  const showAdmin = user ? user.role === 'admin' : !requireLogin;
  if (!showAdmin) return null;
  return (
    <footer>
      <div className="wrap">
        <p className="foot-links"><Link to="/admin">{t('foot.admin')}</Link></p>
      </div>
    </footer>
  );
}
