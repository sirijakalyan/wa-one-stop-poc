import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useT } from '../i18n.js';
import AuthShell, { PasswordField } from '../components/AuthShell.jsx';
import ConfirmEmail from '../components/ConfirmEmail.jsx';

export default function Login() {
  const t = useT();
  const { signIn } = useApp();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState(state?.email || '');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const finish = async () => {
    if (state?.from) return navigate(state.from, { replace: true });
    const c = await api.checklist().catch(() => null);
    return navigate(c?.saved ? '/my-business' : '/', { replace: true });
  };

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const r = await api.login(email, password);
      if (r.needsConfirm) { setConfirming(true); return undefined; }
      signIn(r.user, r.token, r.refreshToken);
      return await finish();
    } catch (e2) {
      setErr(e2.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return <AuthShell title={t('auth.confirmTitle')}><ConfirmEmail email={email.trim().toLowerCase()} password={password} onDone={finish} /></AuthShell>;
  }
  return (
    <AuthShell title={t('auth.welcome')} lead={t('auth.welcomeLead')}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="login-email">{t('auth.email')}</label>
          <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
        </div>
        <PasswordField id="login-password" label={t('auth.password')} value={password} onChange={setPassword} autoComplete="current-password" />
        <p className="auth-row"><Link to="/forgot-password">{t('auth.forgotLink')}</Link></p>
        {state?.notice === 'created' && !err && <p className="ok" role="status">{t('auth.createdNotice')}</p>}
        <p className="err" role="alert">{err}</p>
        <button type="submit" className="btn btn-primary auth-submit" disabled={busy || !email || !password}>{busy ? t('auth.signingIn') : t('auth.signIn')}</button>
      </form>
      <p className="auth-alt">{t('auth.noAccount')} <Link to="/signup" state={state}>{t('auth.signUp')}</Link></p>
      <p className="hint">{t('auth.optional')}</p>
    </AuthShell>
  );
}
