import { Link } from 'react-router-dom';
import { useT } from '../i18n.js';

export default function NotFound() {
  const t = useT();
  return (
    <section className="empty">
      <h1 tabIndex={-1}>{t('nf.title')}</h1>
      <p>{t('nf.text')}</p>
      <Link className="btn btn-primary" to="/">{t('nf.home')}</Link>
    </section>
  );
}
