import { useEffect, useState } from 'react';
import { useT } from '../i18n.js';

// Shown only when an API request is slow, which happens on the first request after the free host sleeps.
export default function WakeNotice() {
  const t = useT();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const on = () => setSlow(true);
    const off = () => setSlow(false);
    window.addEventListener('wa-api-slow', on);
    window.addEventListener('wa-api-done', off);
    return () => {
      window.removeEventListener('wa-api-slow', on);
      window.removeEventListener('wa-api-done', off);
    };
  }, []);
  if (!slow) return null;
  return (
    <p className="wake-notice" role="status">
      {t('wake')}
    </p>
  );
}
