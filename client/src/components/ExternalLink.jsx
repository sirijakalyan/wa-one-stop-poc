import { useState } from 'react';
import { useT } from '../i18n.js';

// Safe external link. Opens in a new tab with no opener or referrer.
// Browsers cannot report why a new tab failed (for example a 502 from the agency site),
// so the fallback text and a copyable address are always shown nearby.
export default function ExternalLink({ href, className, children, fallback, showFallback = false }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  if (!href) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <a className={className} href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <span className="sr-only">{t('ext.newTab')}</span>
      </a>
      {showFallback && (
        <span className="link-fallback">
          {fallback || t('ext.fallback')}{' '}
          <button type="button" className="linklike" onClick={copy}>{copied ? t('ext.copied') : t('ext.copy')}</button>
          <span className="link-url"> {href}</span>
        </span>
      )}
    </>
  );
}
