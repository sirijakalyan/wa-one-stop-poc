import ExternalLink from './ExternalLink.jsx';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n.js';
import { canSpeak, speak, stopSpeaking } from '../voice.js';
import Icon from './Icon.jsx';

// Only one step is read aloud at a time. Opening another step's guide stops the first and starts the new one.
let current = null; // { id, stop }
function narration(item, t) {
  const g = item.guide;
  const body = t.lang === 'es' ? 'en-US' : undefined; // the agency text is in English; headings follow the page language
  const lang = t.lang === 'es' ? 'es-ES' : 'en-US';
  const out = [{ text: item.title, lang: body || lang }];
  const add = (heading, lines) => {
    const list = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
    if (!list.length) return;
    out.push({ text: heading, lang });
    list.forEach((l) => out.push({ text: l, lang: body || lang }));
  };
  if (g.pending && g.pendingNote) add(t('guide.notConfirmed'), g.pendingNote);
  add(t('guide.means'), [g.meaning, item.detail]);
  add(t('guide.who'), g.who);
  add(t('guide.cond'), g.conditions);
  add(t('guide.prep'), g.prepare?.length ? g.prepare : []);
  if (g.steps?.length) {
    out.push({ text: t('gstep.title'), lang });
    g.steps.forEach((s, i) => out.push({ text: `${i + 1}. ${s.text}`.replace(/\s+/g, ' '), lang: body || lang }));
  }
  return out;
}

// The full explanation for one checklist step, shown inside the site.
// All text comes from the rule record and its verified source. Nothing here decides applicability.
export default function Guide({ item }) {
  const t = useT();
  const g = item.guide;
  const [playing, setPlaying] = useState(false);
  const token = useRef(0);
  const detailsRef = useRef(null);
  const halt = () => { token.current += 1; setPlaying(false); if (current?.id === item.id) { current = null; stopSpeaking(); } };
  const play = () => {
    if (current && current.id !== item.id) current.stop(); // the next step's audio takes over
    stopSpeaking();
    const mine = (token.current += 1);
    current = { id: item.id, stop: () => { token.current += 1; setPlaying(false); } };
    setPlaying(true);
    const parts = narration(item, t);
    parts.forEach((p, i) => speak(p.text, {
      lang: p.lang,
      onEnd: () => { if (i === parts.length - 1 && token.current === mine) { setPlaying(false); if (current?.id === item.id) current = null; } },
    }));
  };
  useEffect(() => () => { if (current?.id === item.id) { current = null; stopSpeaking(); } }, [item.id]);
  if (!g) return null;
  const hasExternal = (g.steps || []).some((s) => s.external);
  return (
    <details ref={detailsRef} className="guide" data-testid={`guide-${item.id}`} onToggle={(e) => { if (!canSpeak()) return; if (e.currentTarget.open) play(); else halt(); }}>
      <summary>{t('guide.summary')}</summary>

      {canSpeak() && (
        <div className="guide-audio">
          <button type="button" className="btn btn-quiet btn-sm" aria-pressed={playing} onClick={playing ? halt : play}>
            <Icon name={playing ? 'stop' : 'sound'} size={16} /> {playing ? t('guide.audioStop') : t('guide.audioPlay')}
          </button>
          <span className="hint" role="status">{playing ? t('guide.audioOn') : ''}</span>
        </div>
      )}

      {item.after && <p className="hint">{t('guide.after')}{item.after}</p>}

      {g.pending && (
        <p className="pending-note" role="note"><strong>{t('guide.notConfirmed')}</strong> {g.pendingNote}</p>
      )}

      <h4>{t('guide.means')}</h4>
      <p>{g.meaning}</p>
      {item.detail && <p>{item.detail}</p>}

      <h4>{t('guide.who')}</h4>
      <ul>{(g.who || []).map((t) => <li key={t}>{t}</li>)}</ul>

      {g.conditions?.length > 0 && (
        <>
          <h4>{t('guide.cond')}</h4>
          <ul>{g.conditions.map((t) => <li key={t}>{t}</li>)}</ul>
        </>
      )}

      <h4>{t('guide.prep')}</h4>
      {g.prepare?.length > 0
        ? <ul>{g.prepare.map((t) => <li key={t}>{t}</li>)}</ul>
        : <p className="hint">{g.prepareNote || t('guide.prepNone')}</p>}

      <h4>{t('gstep.title')}</h4>
      <ol>
        {(g.steps || []).map((s) => (
          <li key={s.text}>{s.text}{s.external ? <span className="ext-tag">{t('guide.ext')}</span> : null}</li>
        ))}
      </ol>

      {g.facts?.length > 0 && (
        <>
          <h4>{t('guide.facts')}</h4>
          <p className="hint">{t('guide.factsHint')}</p>
          <ul>
            {g.facts.map((f) => (
              <li key={f.label} className={f.status === 'needs-verification' ? 'needs-verif' : undefined}>
                <strong>{f.label}:</strong>{' '}
                {f.status === 'needs-verification' && <span className="pill maybe">{t('guide.needsVerif')}</span>}{' '}
                {f.text}
                <span className="hint">
                  {' '}{t('guide.checkedOn')}{f.asOf}.
                  {f.source && f.source.url !== item.source?.url && (<>{t('guide.source')}<ExternalLink href={f.source.url}>{f.source.label}</ExternalLink>.</>)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {hasExternal && g.whyExternal && (
        <p className="why-ext"><strong>{t('guide.whyExt')}</strong> {g.whyExternal}</p>
      )}
    </details>
  );
}
