import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';

const SUGGESTIONS = [
  'Do I need a business license?',
  'How long does the DOR license take?',
  'What is workers\' compensation?',
  'What is my next step?',
];
const MAX_TURNS = 8;
const CALM_ERROR = 'Couldn\'t reach the helper just now. Please try again in a moment.';

// Plain words for every failure. Questions the server rejected for a clear reason keep that reason.
function friendlyError(e) {
  if (e?.status === 429) return 'You are asking quickly. Please wait a minute and try again.';
  if (e?.status === 400 && e.message) return e.message;
  return CALM_ERROR;
}
const SLOW_MS = 4000;

// Side chat. Answers come from the server, which answers only from the rule records
// and returns only links stored in those records. History lives in this component only.
export default function ChatPanel() {
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
      const r = await api.chat(q, history);
      setMessages((m) => [...m, { role: 'assistant', content: r.answer, links: r.links || [], matched: r.matched || [], mode: r.mode, suggestions: r.suggestions }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: friendlyError(e), error: true, retry: q }]);
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
          aria-expanded="false"
          aria-controls="chat-panel"
          onClick={() => setOpen(true)}
        >
          <Icon name="chat" size={20} />
          <span>Ask a question</span>
        </button>
      )}
      {open && (
        <section id="chat-panel" className="chat" role="dialog" aria-modal="false" aria-labelledby="chat-title">
          <header className="chat-head">
            <div>
              <h2 id="chat-title">Ask about your checklist</h2>
              <p>Answers come only from this app's rules and guides.</p>
            </div>
            <button type="button" className="chat-close" onClick={close} aria-label="Close chat">
              <Icon name="close" size={20} />
            </button>
          </header>

          <div className="chat-log" aria-live="polite" aria-relevant="additions">
            {messages.length === 0 && (
              <div className="chat-empty">
                <p><strong>Hi, I can help.</strong> Ask me what a step means, what to do next, or for a walk through one step at a time. If I don't have the answer in this app's guides, I'll say so.</p>
                <ul className="chat-suggest">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}><button type="button" onClick={() => send(s)}>{s}</button></li>
                  ))}
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`msg msg--${m.role}${m.error ? ' msg--error' : ''}`}>
                <p className="msg-text">{m.content}</p>
                {m.error && m.retry && (
                  <button type="button" className="btn btn-sm msg-retry" disabled={busy} onClick={() => send(m.retry, messages.slice(0, i - 1))}>Try again</button>
                )}
                {m.matched?.length > 0 && (
                  <p className="msg-from">From: {m.matched.map((x) => x.title).join('; ')}</p>
                )}
                {m.links?.length > 0 && (
                  <ul className="msg-links">
                    {m.links.map((l) => (
                      <li key={l.url}>
                        <a href={l.url} target="_blank" rel="noopener noreferrer">
                          {l.label}<span className="sr-only"> (opens in a new tab)</span>
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
                {slow ? 'Waking up the helper. This can take up to a minute if it has been idle.' : 'Checking the guides...'}
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <label htmlFor="chat-input" className="sr-only">Your question</label>
            <input
              id="chat-input"
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask a question"
              maxLength={500}
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>Send</button>
          </form>
        </section>
      )}
    </>
  );
}
