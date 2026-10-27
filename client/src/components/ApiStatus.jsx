import { useEffect, useState } from 'react';

// Small connection check so reviewers can see where the API answers from.
// In the single-file Claude preview the API runs inside the page and is labeled as simulated.
export const isPreview = () => globalThis.__WA_MODE__ === 'preview';

export default function ApiStatus() {
  const [state, setState] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad status'))))
      .then((body) => {
        if (!cancelled) setState(body.ok ? 'connected' : 'error');
      })
      .catch(() => {
        if (!cancelled) setState('offline');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const labels = {
    checking: 'Checking demo server...',
    connected: isPreview() ? 'Preview: API runs inside this page (simulated server)' : 'Demo server connected',
    offline: 'Demo server not reachable (start it with npm run dev)',
    error: 'Demo server error',
  };

  return (
    <span className={`api-status api-status--${state}`} role="status">
      {labels[state]}
    </span>
  );
}
