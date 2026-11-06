import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { dateLocale, useT } from '../i18n.js';
import { buildPlanPdf } from '../planPdf.js';
import Icon from './Icon.jsx';

// "Keep your plan": three ways to keep it (this device, an emailed link, an account), plus the steps as a PDF.
export default function SaveDialog({ items, label, answers, user, busy, error, onClose, onDevice, onAccount }) {
  const t = useT();
  const [view, setView] = useState('choose'); // choose | email | sent
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sentInfo, setSentInfo] = useState(null);
  const first = useRef(null);
  const box = useRef(null);

  useEffect(() => {
    const was = document.activeElement;
    first.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const f = [...box.current.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]')];
      if (!f.length) return;
      const a = f[0]; const z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); was?.focus?.(); };
  }, [onClose]);
  useEffect(() => { if (view === 'email') box.current?.querySelector('#save-email')?.focus(); }, [view]);

  async function sendLink(e) {
    e.preventDefault();
    setNote('');
    setSending(true);
    try {
      const r = await api.emailPlan({ email: email.trim(), answers, label, origin: window.location.origin });
      setSentInfo(r);
      setView('sent');
    } catch (err) {
      setNote(err.message);
    }
    setSending(false);
  }
  async function pdf() {
    setNote('');
    try {
      // The full plan, the same as My business shows, worked out from the answers. Nothing is saved by this.
      const { items: full, phases, skipped } = await api.evaluate(answers);
      const a = answers;
      const answerLabels = [
        t.card.structure[a.structure] || t('cl.structNo'),
        ...(a.cats || []).map((c) => t.card.cat[c]),
        ...(a.city ? [`${t('cl.city')}: ${a.city}`] : []),
        ...(a.county ? [`${t('cl.county')}: ${t.countyLabel(a.county)}`] : []),
        `${t('cl.hiring')}: ${t.card.yn[a.hiring] || t('cl.notAnswered')}`,
        `${t('cl.sales')}: ${t.card.yn[a.salestax] || t('cl.notAnswered')}`,
        `${t('cl.income')}: ${t.card.yn[a.income] || t('cl.notAnswered')}`,
        `${t('cl.name')}: ${t.card.yn[a.tradename] || t('cl.notAnswered')}`,
      ];
      const today = new Date().toLocaleDateString(dateLocale(t.lang), { year: 'numeric', month: 'long', day: 'numeric' });
      const doc = await buildPlanPdf({ data: { items: full, phases, skipped, answerLabels }, label, t, today });
      doc.save('my-washington-business-plan.pdf');
    } catch {
      setNote(t('save.pdfFail'));
    }
  }

  return (
    <div className="save-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="save-dialog" role="dialog" aria-modal="true" aria-labelledby="save-title" ref={box}>
        <button type="button" className="save-x" onClick={onClose} aria-label={t('save.close')}><Icon name="close" size={20} /></button>
        <h2 id="save-title">{t('save.title')}</h2>

        {view === 'choose' ? (
          <>
            <p className="save-lead">{user ? t('save.leadIn') : t('save.lead')}</p>
            <ul className="save-opts">
              {!user ? (
                <li>
                  <button type="button" className="save-opt is-rec" ref={first} onClick={onAccount} disabled={busy}>
                    <span className="icon-tile tone-rec"><Icon name="user" size={22} /></span>
                    <span className="save-opt-text"><strong>{t('save.account')} <em className="save-rec">{t('save.recommended')}</em></strong><span>{t('save.accountText')}</span></span>
                    <span className="save-go" aria-hidden="true">›</span>
                  </button>
                </li>
              ) : (
                <li>
                  <button type="button" className="save-opt is-rec" ref={first} onClick={onDevice} disabled={busy}>
                    <span className="icon-tile tone-rec"><Icon name="user" size={22} /></span>
                    <span className="save-opt-text"><strong>{t('save.deviceIn')} <em className="save-rec">{t('save.recommended')}</em></strong><span>{t('save.deviceInText')}</span></span>
                    <span className="save-go" aria-hidden="true">›</span>
                  </button>
                </li>
              )}
              <li>
                <button type="button" className="save-opt" onClick={onDevice} disabled={busy}>
                  <span className="icon-tile tone-device"><Icon name="home" size={22} /></span>
                  <span className="save-opt-text"><strong>{t('save.device')}</strong><span>{t('save.deviceText')}</span></span>
                  <span className="save-go" aria-hidden="true">›</span>
                </button>
              </li>
              <li>
                <button type="button" className="save-opt" onClick={() => setView('email')} disabled={busy}>
                  <span className="icon-tile tone-mail"><Icon name="chat" size={22} /></span>
                  <span className="save-opt-text"><strong>{t('save.email')}</strong><span>{t('save.emailText')}</span></span>
                  <span className="save-go" aria-hidden="true">›</span>
                </button>
              </li>
              <li>
                <button type="button" className="save-opt" onClick={pdf} disabled={!items.length}>
                  <span className="icon-tile tone-pdf"><Icon name="file" size={22} /></span>
                  <span className="save-opt-text"><strong>{t('save.pdf')}</strong><span>{t('save.pdfText')}</span></span>
                  <span className="save-go" aria-hidden="true">›</span>
                </button>
              </li>
            </ul>
            {error || note ? <p className="save-note" role="alert">{error || note}</p> : null}
          </>
        ) : null}

        {view === 'email' ? (
          <form onSubmit={sendLink} noValidate>
            <p className="save-lead">{t('save.emailLead')}</p>
            <label htmlFor="save-email" className="save-label">{t('save.emailLabel')}</label>
            <input id="save-email" type="email" autoComplete="email" inputMode="email" maxLength={160} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            <p className="hint">{t('save.emailPrivacy')}</p>
            {note ? <p className="save-note" role="alert">{note}</p> : null}
            <div className="save-row">
              <button type="submit" className="btn btn-primary" disabled={sending || !email.trim()}>{sending ? t('save.sending') : t('save.sendLink')}</button>
              <button type="button" className="btn btn-quiet" onClick={() => { setView('choose'); setNote(''); }}>{t('save.back')}</button>
            </div>
          </form>
        ) : null}

        {view === 'sent' ? (
          <div>
            <p className="save-lead" role="status">{sentInfo?.live ? t('save.sent').replace('{email}', email.trim()) : t('save.sentDemo')}</p>
            <div className="save-row">
              <button type="button" className="btn btn-primary" onClick={onDevice} disabled={busy}>{t('save.alsoDevice')}</button>
              <button type="button" className="btn btn-quiet" onClick={onClose}>{t('save.done')}</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
