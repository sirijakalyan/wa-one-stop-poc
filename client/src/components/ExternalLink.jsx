import { useState } from 'react';

// Safe external link. Opens in a new tab with no opener or referrer.
// Browsers cannot report why a new tab failed (for example a 502 from the agency site),
// so the fallback text and a copyable address are always shown nearby.
export default function ExternalLink({ href, className, children, fallback, showFallback = false }) {
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
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {showFallback && (
        <span className="link-fallback">
          {fallback || 'If this page does not open, the agency site may be down. Try again later or search for the agency name.'}{' '}
          <button type="button" className="linklike" onClick={copy}>{copied ? 'Copied' : 'Copy address'}</button>
          <span className="link-url"> {href}</span>
        </span>
      )}
    </>
  );
}
