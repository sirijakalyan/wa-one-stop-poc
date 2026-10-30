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

// Shows the password rules as a short list that ticks off while the person types, instead of a sentence they have to read first.
const PW_RULES = [
  ['auth.pwLen', (v) => v.length >= 8],
  ['auth.pwLetter', (v) => /[A-Za-z]/.test(v)],
  ['auth.pwNumber', (v) => /\d/.test(v)],
];
export function PasswordField({ id, label, value, onChange, autoComplete, hint, rules = false, required = true }) {
  const t = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-row">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required={required} aria-describedby={rules ? `${id}-rules` : hint ? `${id}-hint` : undefined} />
        <button type="button" className="btn btn-quiet btn-sm" aria-pressed={show} onClick={() => setShow((s) => !s)}>{show ? t('auth.hide') : t('auth.show')}</button>
      </div>
      {rules ? (
        <ul id={`${id}-rules`} className="pw-rules" aria-label={t('auth.pwRulesLabel')}>
          {PW_RULES.map(([key, ok]) => {
            const met = ok(value || '');
            return <li key={key} className={met ? 'is-met' : ''}><span aria-hidden="true">{met ? '\u2713' : '\u25CB'}</span> {t(key)}<span className="sr-only">{met ? ` (${t('auth.pwDone')})` : ''}</span></li>;
          })}
        </ul>
      ) : hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
    </div>
  );
}
