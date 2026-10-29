import { useState } from 'react';
import Icon from './Icon.jsx';
import { useT } from '../i18n.js';

// One layout for sign in, sign up, forgot password and reset: a short reassurance panel beside a single focused form.
export default function AuthShell({ title, lead, children }) {
  const t = useT();
  return (
    <div className="auth">
      <aside className="auth-side" aria-hidden="false">
        <ul>
          <li><Icon name="check" size={20} /><div><strong>{t('auth.side1')}</strong><span>{t('auth.side1d')}</span></div></li>
          <li><Icon name="list" size={20} /><div><strong>{t('auth.side2')}</strong><span>{t('auth.side2d')}</span></div></li>
          <li><Icon name="shield" size={20} /><div><strong>{t('auth.side3')}</strong><span>{t('auth.side3d')}</span></div></li>
        </ul>
      </aside>
      <section className="auth-card" aria-labelledby="auth-title">
        <h1 id="auth-title" tabIndex={-1}>{title}</h1>
        {lead && <p className="auth-lead">{lead}</p>}
        {children}
      </section>
    </div>
  );
}

export function PasswordField({ id, label, value, onChange, autoComplete, hint, required = true }) {
  const t = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-row">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required={required} aria-describedby={hint ? `${id}-hint` : undefined} />
        <button type="button" className="btn btn-quiet btn-sm" aria-pressed={show} onClick={() => setShow((s) => !s)}>{show ? t('auth.hide') : t('auth.show')}</button>
      </div>
      {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
    </div>
  );
}
