import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useT } from '../i18n.js';
import AuthShell from '../components/AuthShell.jsx';

export default function ForgotPassword() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      setResult(await api.forgot(email));
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t('auth.forgotTitle')} lead={result ? '' : t('auth.forgotLead')}>
      {result ? (
        <div role="status" className="auth-done">
          <p>{result.message}</p>
          {result.codeSent && (
            <p><Link className="btn btn-primary btn-sm" to={`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`}>{t('auth.enterCode')}</Link></p>
          )}
          {result.demoLink && (
            <p className="note">{t('auth.demoLink')} <Link className="btn btn-sm" to={result.demoLink}>{t('auth.openLink')}</Link></p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="fp-email">{t('auth.email')}</label>
            <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          </div>
          <p className="err" role="alert">{err}</p>
          <button type="submit" className="btn btn-primary auth-submit" disabled={busy || !email}>{busy ? t('auth.sending') : t('auth.sendLink')}</button>
        </form>
      )}
      <p className="auth-alt"><Link to="/login">{t('auth.back')}</Link></p>
    </AuthShell>
  );
}
