import { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useT } from '../i18n.js';

// Shown after sign up with AWS Cognito, and when someone signs in before confirming. Enter the 6-digit code from the email.
export default function ConfirmEmail({ email, password, onDone, signInAfter = true }) {
  const t = useT();
  const { signIn } = useApp();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setNote(''); setBusy(true);
    try {
      await api.confirmEmail(email, code.trim());
      if (signInAfter) {
        const r = await api.login(email, password);
        signIn(r.user, r.token, r.refreshToken);
      }
      onDone();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setErr(''); setNote('');
    try { setNote((await api.resendCode(email)).message); } catch (e2) { setErr(e2.message); }
  }
  return (
    <form onSubmit={submit} noValidate>
      <p className="auth-lead">{t('auth.confirmLead', email)}</p>
      <div className="field">
        <label htmlFor="cf-code">{t('auth.code')}</label>
        <input id="cf-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={10} autoFocus required />
      </div>
      <p className="err" role="alert">{err}</p>
      {note && <p className="ok" role="status">{note}</p>}
      <button type="submit" className="btn btn-primary auth-submit" disabled={busy || !code.trim()}>{busy ? t('auth.saving') : t(signInAfter ? 'auth.confirmBtn' : 'auth.confirmOnly')}</button>
      <p className="auth-alt"><button type="button" className="linklike" onClick={resend}>{t('auth.resend')}</button></p>
    </form>
  );
}
