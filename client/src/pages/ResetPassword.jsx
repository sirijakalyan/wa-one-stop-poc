import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useT } from '../i18n.js';
import AuthShell, { PasswordField } from '../components/AuthShell.jsx';

export default function ResetPassword() {
  const t = useT();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (password !== again) return setErr(t('auth.mismatch'));
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  if (!token) {
    return (
      <AuthShell title={t('auth.resetTitle')}>
        <p role="alert" className="err">{t('auth.noToken')}</p>
        <p className="auth-alt"><Link to="/forgot-password">{t('auth.forgotTitle')}</Link></p>
      </AuthShell>
    );
  }
  if (done) {
    return (
      <AuthShell title={t('auth.done')}>
        <p role="status"><Link className="btn btn-primary" to="/login">{t('auth.goSignIn')}</Link></p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={t('auth.resetTitle')} lead={t('auth.resetLead')}>
      <form onSubmit={submit} noValidate>
        <PasswordField id="rp-password" label={t('auth.newPassword')} value={password} onChange={setPassword} autoComplete="new-password" hint={t('auth.pwHint')} />
        <PasswordField id="rp-again" label={t('auth.confirm')} value={again} onChange={setAgain} autoComplete="new-password" />
        <p className="err" role="alert">{err}</p>
        <button type="submit" className="btn btn-primary auth-submit" disabled={busy || !password || !again}>{busy ? t('auth.saving') : t('auth.resetSave')}</button>
      </form>
    </AuthShell>
  );
}
