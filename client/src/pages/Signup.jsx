import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useT } from '../i18n.js';
import AuthShell, { PasswordField } from '../components/AuthShell.jsx';
import ConfirmEmail from '../components/ConfirmEmail.jsx';

export default function Signup() {
  const t = useT();
  const { signIn } = useApp();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const finish = async () => {
    const c = await api.checklist().catch(() => null);
    navigate(state?.from || (c?.saved ? '/my-business' : '/'), { replace: true });
  };

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const r = await api.signup(name, email, password);
      if (r.needsConfirm) { setConfirming(true); return; } // AWS Cognito: confirm the emailed code first
      signIn(r.user, r.token, r.refreshToken);
      await finish(); // a plan made before signing up moved to the account
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return <AuthShell title={t('auth.confirmTitle')}><ConfirmEmail email={email.trim().toLowerCase()} password={password} onDone={finish} /></AuthShell>;
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
        <p className="err" role="alert">{err}</p>
        <button type="submit" className="btn btn-primary auth-submit" disabled={busy || !name || !email || !password}>{busy ? t('auth.creating') : t('auth.signUp')}</button>
      </form>
      <p className="auth-alt">{t('auth.haveAccount')} <Link to="/login" state={state}>{t('auth.signIn')}</Link></p>
      <p className="hint">{t('auth.optional')}</p>
    </AuthShell>
  );
}
