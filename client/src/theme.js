import { useCallback, useEffect, useState } from 'react';

const KEY = 'wa-theme';

function current() {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

// Light is the default. The choice is remembered in this browser only.
export function useTheme() {
  const [theme, setTheme] = useState(current);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const choose = useCallback((next) => {
    setTheme(next === 'dark' ? 'dark' : 'light');
    try { localStorage.setItem(KEY, next === 'dark' ? 'dark' : 'light'); } catch { /* storage may be blocked */ }
  }, []);
  const toggle = useCallback(() => choose(current() === 'dark' ? 'light' : 'dark'), [choose]);
  return { theme, toggle, choose };
}
