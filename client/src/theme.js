import { useCallback, useEffect, useState } from 'react';

const KEY = 'wa-theme';

function current() {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

// Light is the default. The choice is remembered in this browser only.
export function useTheme() {
  const [theme, setTheme] = useState(current);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch { /* storage may be blocked */ }
      return next;
    });
  }, []);
  return { theme, toggle };
}
