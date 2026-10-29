import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, setSession } from '../api.js';
import { useT } from '../i18n.js';
import AuthShell, { PasswordField } from '../components/AuthShell.jsx';
import ConfirmEmail from '../components/ConfirmEmail.jsx';

export default function Signup() {
  const t = useT();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Creating an account does not sign anyone in. They are sent to Sign in, then see their plan or Home.
  const toSignIn = (mail) => navigate('/login', { replace: true, state: { ...state, email: mail, notice: 'created' } });

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (password !== again) return setErr(t('auth.mismatch'));
    setBusy(true);
    try {
      const r = await api.signup(name, email, password);
      if (r.needsConfirm) { setConfirming(true); return undefined; } // AWS Cognito: confirm the emailed code first
      if (r.token) { setSession(r.token); await api.logout().catch(() => {}); setSession(''); } // drop the session the server opened
      toSignIn(email.trim().toLowerCase());
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  if (confirming) {
    return <AuthShell title={t('auth.confirmTitle')}><ConfirmEmail email={email.trim().toLowerCase()} password={password} signInAfter={false} onDone={() => toSignIn(email.trim().toLowerCase())} /></AuthShell>;
  }
  return (
    <AuthShell title={t('auth.new')} lead={t('auth.newLead')}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="su-name">{t('auth.name')}</label>
          <input id="su-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required autoFocus maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="su-email">{t('auth.email')}</label>
          <input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <PasswordField id="su-password" label={t('auth.password')} value={password} onChange={setPassword} autoComplete="new-password" hint={t('auth.pwHint')} />
        <PasswordField id="su-again" label={t('auth.confirmPw')} value={again} onChange={setAgain} autoComplete="new-password" />
        <p className="err" role="alert">{err}</p>
        <button type="submit" className="btn btn-primary auth-submit" disabled={busy || !name || !email || !password || !again}>{busy ? t('auth.creating') : t('auth.signUp')}</button>
      </form>
      <p className="auth-alt">{t('auth.haveAccount')} <Link to="/login" state={state}>{t('auth.signIn')}</Link></p>
      <p className="hint">{t('auth.optional')}</p>
    </AuthShell>
  );
}
