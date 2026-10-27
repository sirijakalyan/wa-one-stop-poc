import { useEffect, useState } from 'react';

// Shown only when an API request is slow, which happens on the first request after the free host sleeps.
export default function WakeNotice() {
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
      Waking up the server. The free host can take up to a minute after it sits idle. Thanks for waiting.
    </p>
  );
}
