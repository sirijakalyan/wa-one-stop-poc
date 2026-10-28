// Small shared pieces.
import { useT } from '../i18n.js';

export function Meter({ percent, labelledBy, label }) {
  return (
    <div
      className="meter"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={percent}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
    >
      <span style={{ width: `${Math.max(percent, 3)}%` }} />
    </div>
  );
}

export function Chips({ items }) {
  return (
    <ul className="chips">
      {items.map((c) => (
        <li key={c} className="chip">{c}</li>
      ))}
    </ul>
  );
}

export function ErrorNote({ message }) {
  if (!message) return null;
  return <p className="err" role="alert">{message}</p>;
}

export function Loading({ what = 'Loading' }) {
  return <p className="hint" role="status">{what}...</p>;
}

export const OWNER_FALLBACK = '[NEEDS HUMAN INPUT: content owner]';
export const REVIEWER_FALLBACK = '[NEEDS HUMAN INPUT: second-person reviewer]';

export function statusLabel(verification, t) {
  const checked = verification?.status === 'checked';
  if (t) return t(checked ? 'status.checked' : 'status.pending');
  return checked ? 'Checked' : 'Pending verification';
}

// Checked: someone read the official page and it supports the rule.
// Approved: a named reviewer approved the rule record in the admin screen.
export function approvalLabel(rule, t) {
  if (t) return rule?.reviewer ? t('approve.by', rule.reviewer) : t('approve.not');
  return rule?.reviewer ? `Approved by ${rule.reviewer}` : 'Not yet Approved';
}

export function Simulated({ children }) {
  const t = useT();
  return <span className="pill sim">{children || t('pill.simulated')}</span>;
}

export function VerifyNote({ verification, lastVerified }) {
  if (verification?.status === 'checked') {
    return <span>Checked{lastVerified ? ` ${lastVerified}` : ''}. Not yet Approved</span>;
  }
  return <span>Pending verification</span>;
}
