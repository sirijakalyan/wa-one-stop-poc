import { useCallback, useEffect, useRef, useState } from 'react';
import { speechLang, useT } from '../i18n.js';
import { canSpeak, hasVoice, speak, speakable, stopSpeaking } from '../voice.js';
import ExternalLink from './ExternalLink.jsx';
import Icon from './Icon.jsx';

// What is read aloud for one step. It only repeats what is already on the card: the title, the short reason, the button name
// and the pending note. Nothing is added about fees, dates or approval.
export function stepScript(item, n, total, t) {
  const parts = [t('sp.step', n, total, item.title)];
  const reason = speakable(item.reason || '', 220, t.lang);
  if (reason) parts.push(reason);
  if (item.verification?.status === 'pending') parts.push(t('sp.pending'));
  if (item.apply?.url) parts.push(t('sp.link', item.apply.label));
  else parts.push(t('sp.noLink'));
  parts.push(t('sp.after'));
  return parts.join(' ');
}

// A spoken walk through the checklist, one step at a time: it reads the step, you open the page and do it, tick
// "Mark as done", and it moves on to the next one. It uses the browser's own voice, so nothing is sent to our server.
export default function StepAudio({ items, onActive }) {
  const t = useT();
  const [idx, setIdx] = useState(-1); // position in `list`; -1 when stopped
  const [talking, setTalking] = useState(false);
  const list = useRef([]);
  const run = useRef(0); // bumped on every start/stop so a line that ends late cannot move things on
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const say = useCallback((text, after) => {
    const mine = run.current;
    setTalking(true);
    speak(speakable(text, 1100, t.lang), {
      lang: speechLang(t.lang),
      onEnd: () => { if (run.current === mine) { setTalking(false); after?.(); } },
      onSilent: () => { if (run.current === mine) setTalking(false); },
    });
  }, [t.lang]);

  const readStep = useCallback((i, lead = '') => {
    const ids = list.current;
    const item = itemsRef.current.find((x) => x.id === ids[i]);
    if (!item) return;
    setIdx(i);
    onActive?.(item.id);
    run.current += 1;
    stopSpeaking();
    say(`${lead}${stepScript(item, i + 1, ids.length, t)}`);
  }, [say, t, onActive]);

  const finish = useCallback((text) => {
    run.current += 1;
    stopSpeaking();
    setIdx(-1);
    onActive?.('');
    if (text) say(text);
  }, [say, onActive]);

  function start() {
    const todo = items.filter((i) => !i.done).map((i) => i.id);
    if (!todo.length) { say(t('sp.allDone')); return; }
    list.current = todo;
    readStep(0, `${t('sp.intro', todo.length)} `);
  }
  function stop() { finish(''); setTalking(false); }
  const go = (i) => {
    if (i >= list.current.length) { finish(t('sp.end')); return; }
    if (i >= 0) readStep(i);
  };

  // Ticking "Mark as done" on the step being read moves on to the next one.
  const currentId = idx >= 0 ? list.current[idx] : '';
  const currentDone = idx >= 0 && items.find((i) => i.id === currentId)?.done;
  useEffect(() => {
    if (idx < 0 || !currentDone) return;
    const next = idx + 1;
    if (next >= list.current.length) { finish(t('sp.end')); return; }
    readStep(next, `${t('sp.marked')} `);
  }, [currentDone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { run.current += 1; stopSpeaking(); }, []);

  if (!canSpeak()) return <p className="hint" role="note">{t('sp.cannot')}</p>;
  const current = idx >= 0 ? items.find((i) => i.id === currentId) : null;
  const noVoice = t.lang === 'es' && !hasVoice(speechLang('es'));

  return (
    <section className="step-audio" aria-label={t('sp.title')}>
      <div className="step-audio-top">
        <Icon name="sound" size={20} />
        <div>
          <h3>{t('sp.title')}</h3>
          <p className="hint">{t('sp.how')}</p>
        </div>
        {idx < 0
          ? <button type="button" className="btn btn-primary btn-sm" onClick={start}>{t('sp.play')}</button>
          : <button type="button" className="btn btn-sm" onClick={stop}>{t('sp.stop')}</button>}
      </div>
      {noVoice && <p className="hint" role="note">{t('voice.noEs')}</p>}
      {current && (
        <div className="step-audio-now" role="status" aria-live="polite">
          <p><strong>{t('sp.now', idx + 1, list.current.length)}</strong> {current.title}</p>
          <p className="hint">{talking ? t('sp.reading') : t('sp.waiting')}</p>
          <div className="row">
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => go(idx - 1)} disabled={idx === 0}>{t('sp.prev')}</button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => readStep(idx)}>{t('sp.repeat')}</button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => go(idx + 1)}>{t('sp.next')}</button>
            {current.apply?.url && <ExternalLink className="btn btn-primary btn-sm" href={current.apply.url}>{current.apply.label}</ExternalLink>}
          </div>
        </div>
      )}
    </section>
  );
}
