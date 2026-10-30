import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import { useT } from '../i18n.js';

const SUGGESTION_KEYS = ['ch.s1', 'ch.s2', 'ch.s3', 'ch.s4'];
const MAX_TURNS = 8;

// Plain words for every failure. Questions the server rejected for a clear reason keep that reason.
function friendlyError(e, t) {
  if (e?.status === 429) return t('ch.err429');
  if (e?.status === 400 && e.message) return e.message;
  return t('ch.errCalm');
}
const SLOW_MS = 4000;

// Side chat. Answers come from the server, which answers only from the rule records
// and returns only links stored in those records. History lives in this component only.
export default function ChatPanel() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const inputRef = useRef(null);
  const openerRef = useRef(null);
  const endRef = useRef(null);
  const [away, setAway] = useState(false);

  // On a phone the round button slides out of the way while you scroll down, so it never sits on a checklist button.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - last;
      if (y <= 120) setAway(false);
      else if (Math.abs(dy) > 6) { setAway(dy > 0); last = y; }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages, busy]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function close() {
    setOpen(false);
    openerRef.current?.focus();
  }

  // Turns that failed are never sent back as history, so a retry starts from the last good answer.
  async function send(question, base = messages) {
    const q = String(question ?? text).trim();
    if (!q || busy) return;
    const history = base.filter((m) => !m.error).slice(-MAX_TURNS).map((m) => ({ role: m.role, content: m.content }));
    setMessages([...base, { role: 'user', content: q }]);
    setText('');
    setBusy(true);
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    try {
      const r = await api.chat(q, history, t.lang);
      setMessages((m) => [...m, { role: 'assistant', content: r.answer, links: r.links || [], matched: r.matched || [], mode: r.mode, suggestions: r.suggestions }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: friendlyError(e, t), error: true, retry: q }]);
    } finally {
      clearTimeout(timer);
      setBusy(false);
      setSlow(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          ref={openerRef}
          className={`chat-fab${away ? ' is-away' : ''}`}
          onFocus={() => setAway(false)}
          aria-label={t('ch.fab')}
          aria-expanded="false"
          onClick={() => setOpen(true)}
        >
          <Icon name="chat" size={20} />
          <span>{t('ch.fab')}</span>
        </button>
      )}
      {open && (
        <section id="chat-panel" className="chat" role="dialog" aria-modal="false" aria-labelledby="chat-title">
          <div className="chat-head">
            <div>
              <h2 id="chat-title">{t('ch.title')}</h2>
              <p>{t('ch.sub')}</p>
            </div>
            <button type="button" className="chat-close" onClick={close} aria-label={t('ch.close')}>
              <Icon name="close" size={20} />
            </button>
          </div>

          <div className="chat-log" aria-live="polite" aria-relevant="additions">
            {messages.length === 0 && (
              <div className="chat-empty">
                <p><strong>{t('ch.hi').split('. ')[0]}.</strong> {t('ch.hi').split('. ').slice(1).join('. ')}</p>
                <ul className="chat-suggest">
                  {SUGGESTION_KEYS.map((k) => (
                    <li key={k}><button type="button" onClick={() => send(t(k))}>{t(k)}</button></li>
                  ))}
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`msg msg--${m.role}${m.error ? ' msg--error' : ''}`}>
                <p className="msg-text">{m.content}</p>
                {m.error && m.retry && (
                  <button type="button" className="btn btn-sm msg-retry" disabled={busy} onClick={() => send(m.retry, messages.slice(0, i - 1))}>{t('ch.retry')}</button>
                )}
                {m.matched?.length > 0 && (
                  <p className="msg-from">{t('ch.from')}{m.matched.map((x) => x.title).join('; ')}</p>
                )}
                {m.links?.length > 0 && (
                  <ul className="msg-links">
                    {m.links.map((l) => (
                      <li key={l.url}>
                        <a href={l.url} target="_blank" rel="noopener noreferrer">
                          {l.label}<span className="sr-only">{t('ext.newTab')}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {m.suggestions?.length > 0 && (
                  <ul className="chat-suggest">
                    {m.suggestions.map((s) => (
                      <li key={s}><button type="button" onClick={() => send(s)}>{s}</button></li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {busy && (
              <p className="msg-status" role="status">
                {slow ? t('ch.slow') : t('ch.busy')}
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <label htmlFor="chat-input" className="sr-only">{t('ch.q')}</label>
            <input
              id="chat-input"
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('ch.ph')}
              maxLength={500}
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>{t('ch.send')}</button>
          </form>
        </section>
      )}
    </>
  );
}
