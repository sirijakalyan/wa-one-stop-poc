import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import BusinessCard from '../components/BusinessCard.jsx';
import PlanPanel from '../components/PlanPanel.jsx';
import Timeline from '../components/Timeline.jsx';
import SimulatePanel from '../components/SimulatePanel.jsx';
import GuideArt from '../components/GuideArt.jsx';
import ExternalLink from '../components/ExternalLink.jsx';
import Icon from '../components/Icon.jsx';
import { ErrorNote } from '../components/Parts.jsx';
import { canListen, canSpeak, createListener, hasVoice, listenErrorText, speak, speakable, stopSpeaking } from '../voice.js';
import { answersFromCard, confirmedCount } from '../guideCard.js';
import { speechLang, useT } from '../i18n.js';

const GREETING = { id: 'hello', role: 'guide', text: '' };
let counter = 0;
const nextId = () => `m${Date.now().toString(36)}${counter++}`;

const SAVE_RX = /^\s*(?:(?:ok|okay|yes|please|now|then|so)[\s,]+)*(?:save|keep|store)\b|\b(?:save|keep|store|open)\b[^.?!]{0,20}\b(?:plan|checklist)\b/i;
const SAVE_ES = /^\s*(?:(?:ok|okay|s[ií]|por favor|ahora|entonces|bueno)[\s,]+)*(?:guardar|guarda|guarde|conservar|conserva)(?![\p{L}])|(?<![\p{L}])(?:guardar|guarda|guarde|conservar|abrir)(?![\p{L}])[^.?!]{0,20}(?<![\p{L}])(?:plan|lista)(?![\p{L}])/iu;

// Main screen: the conversation on the left; the business card, the plan and the road to opening day fill in on the right.
// embedded: shown inside the home page. mode and start come from the home page's Talk / Type switch and its sentence box.
export default function Guide({ embedded = false, mode: modeProp, start: startProp } = {}) {
  const { guide, setGuide, setAnswers, setLabel, setStep, setCatsAuto } = useApp();
  const t = useT();
  const langRef = useRef(t.lang);
  langRef.current = t.lang;
  const FIELD_LABELS = t.card.fields;
  const location = useLocation();
  const navigate = useNavigate();
  const [firstMode] = useState(location.state?.mode || 'type');
  const mode = modeProp || firstMode;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState({ plan: null, timeline: null });
  const [sim, setSim] = useState(null);
  const [tab, setTab] = useState('chat');
  const [newIds, setNewIds] = useState(new Set());
  const guideRef = useRef(guide);
  guideRef.current = guide;
  const seenIds = useRef(new Set());
  const inputRef = useRef(null);
  const logRef = useRef(null);
  const started = useRef(false);

  // Voice: the guide speaks its replies and the owner can talk back. It starts only after a tap (Talk to me, the microphone or Unmute).
  const [voiceOn, setVoiceOn] = useState(mode === 'talk' && canSpeak());
  const [micOn, setMicOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState('');
  const [tick, setTick] = useState(0);
  const prevMode = useRef(mode);
  const spokenIdx = useRef(guide.messages.length > 1 ? guide.messages.length : 0); // a returning visitor is not read the old conversation again
  const greetHeard = useRef(false);
  const [speakTick, setSpeakTick] = useState(0);
  const autoMic = useRef(false);
  const voiceOnRef = useRef(false);
  const saveRef = useRef(() => {});
  const speakingCount = useRef(0);
  const listenerRef = useRef(null);
  const cond = useRef({});
  const turnRef = useRef(null);

  // The greeting is stored without text, so it always shows in the language chosen right now.
  const localized = (m) => (m.id === 'hello' ? { ...m, text: t('home.greeting') } : m);
  const messages = (guide.messages.length ? guide.messages : [GREETING]).map(localized);
  const last = messages[messages.length - 1];

  const refreshPlan = useCallback(async (card, simulate = false) => {
    if (!confirmedCount(card)) {
      setView({ plan: { items: [], skipped: [] }, timeline: null });
      return;
    }
    const r = await api.intakePlan(card, simulate);
    const fresh = new Set(r.plan.items.map((i) => i.id).filter((id) => !seenIds.current.has(id)));
    r.plan.items.forEach((i) => seenIds.current.add(i.id));
    setNewIds(fresh);
    setView({ plan: r.plan, timeline: r.timeline });
    if (fresh.size) setTimeout(() => setNewIds(new Set()), 1600);
  }, []);

  const turn = useCallback(async (body, ownerText) => {
    // Once the card is complete, saying "save my plan" does the same as tapping the button.
    if (body.message && guideRef.current.complete && (langRef.current === 'es' ? SAVE_ES : SAVE_RX).test(body.message)) {
      setGuide((g) => ({ ...g, messages: [...g.messages, { id: nextId(), role: 'owner', text: ownerText || body.message }] }));
      saveRef.current();
      return;
    }
    setBusy(true);
    setError('');
    const owner = ownerText ? { id: nextId(), role: 'owner', text: ownerText } : null;
    setGuide((g) => ({ ...g, messages: [...(g.messages.length ? g.messages : [GREETING]), ...(owner ? [owner] : [])] }));
    try {
      const cur = guideRef.current;
      const r = await api.intakeTurn({ card: cur.card, asking: cur.ask?.field, lang: langRef.current, ...body });
      const added = [{ id: nextId(), role: 'guide', text: r.reply, links: r.answer?.links || [] }];
      if (r.followUp) added.push({ id: nextId(), role: 'guide', text: r.followUp });
      setGuide((g) => ({ ...g, messages: [...g.messages, ...added], card: r.card, ask: r.ask, awaiting: r.awaiting, complete: r.complete, chips: r.chips || [] }));
      await refreshPlan(r.card, false);
      setSim(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [refreshPlan, setGuide]);

  turnRef.current = turn;
  // Switching Talk and Type on the home page: Talk turns the guide's voice on (the switch is the tap), Type turns voice and microphone off.
  useEffect(() => {
    if (prevMode.current === mode) return;
    prevMode.current = mode;
    if (mode === 'talk') { if (canSpeak()) setVoiceOn(true); } else {
      stopSpeaking();
      speakingCount.current = 0;
      setSpeaking(false);
      setMicOn(false);
      setVoiceOn(false);
    }
  }, [mode]);
  // Switching language mid-conversation: stop talking, then say the current question again in the new language.
  voiceOnRef.current = voiceOn;
  const prevLang = useRef(t.lang);
  useEffect(() => {
    if (prevLang.current === t.lang) return;
    prevLang.current = t.lang;
    stopSpeaking();
    speakingCount.current = 0;
    setSpeaking(false);
    // The plan and the road come back from the server in the new language.
    refreshPlan(guideRef.current.card, false);
    if (guideRef.current.messages.length > 1) turnRef.current({}, null);
    // Only the greeting so far: say it again in the new language.
    else { spokenIdx.current = 0; greetHeard.current = false; setSpeakTick((n) => n + 1); }
  }, [t.lang]);
  saveRef.current = save;
  cond.current = { micOn, speaking, busy };

  // Read each new guide line aloud, in order. Lines the owner typed or older lines are never read.
  useEffect(() => {
    if (!voiceOn) { spokenIdx.current = messages.length; return; }
    for (let i = spokenIdx.current; i < messages.length; i += 1) {
      if (messages[i].role !== 'guide') continue;
      speakingCount.current += 1;
      setSpeaking(true);
      speak(speakable(messages[i].text, 340, langRef.current), {
        lang: speechLang(langRef.current),
        onStart: () => { greetHeard.current = true; },
        onSilent: () => setVoiceMsg(t('voice.silent')),
        onEnd: () => {
          speakingCount.current = Math.max(0, speakingCount.current - 1);
          if (!speakingCount.current) setSpeaking(false);
        },
      });
    }
    spokenIdx.current = messages.length;
  }, [messages, voiceOn, speakTick]);

  // Listen only while the microphone is on and the guide is neither speaking nor thinking, so it never hears itself.
  useEffect(() => {
    const l = listenerRef.current;
    if (micOn && !speaking && !busy) { l?.start(); setListening(true); } else { l?.stop(); setListening(false); }
  }, [micOn, speaking, busy, tick]);
  // On leaving the page, stop talking and listening. Resetting the counters also makes React's dev double-mount start the greeting again after its cancel.
  useEffect(() => () => { stopSpeaking(); listenerRef.current?.stop(); spokenIdx.current = 0; speakingCount.current = 0; }, []);

  function ensureListener() {
    if (!canListen()) { setVoiceMsg(t('voice.cannotListen')); return false; }
    if (!listenerRef.current) {
      listenerRef.current = createListener({
        getLang: () => speechLang(langRef.current),
        onInterim: (t) => setText(t),
        onFinal: (t) => { setText(''); turnRef.current({ message: t }, t); },
        onEnd: () => {
          setListening(false);
          const c = cond.current;
          if (c.micOn && !c.speaking && !c.busy) setTimeout(() => setTick((n) => n + 1), 120);
        },
        onError: (code) => {
          const msg = listenErrorText(code, langRef.current);
          if (msg) { setVoiceMsg(msg); setMicOn(false); }
        },
      });
    }
    return true;
  }
  function toggleMic() {
    setVoiceMsg('');
    if (!ensureListener()) return;
    if (!micOn && canSpeak()) setVoiceOn(true);
    setMicOn(!micOn);
  }
  // Talk mode opens with the greeting spoken and the microphone on, with no tap needed. If the browser holds the voice back
  // until the page has been touched, the first tap or key press anywhere says the greeting. If it also holds the microphone
  // back (no permission yet), the error text below the buttons says so and the microphone button still works.
  useEffect(() => {
    if (mode !== 'talk' || autoMic.current) return;
    autoMic.current = true;
    if (ensureListener()) setMicOn(true);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode !== 'talk' || !voiceOn) return undefined;
    const unlock = () => {
      if (greetHeard.current) return;
      const first = guideRef.current.messages[0];
      if (!first || guideRef.current.messages.length > 1) return;
      stopSpeaking();
      speakingCount.current = 1;
      setSpeaking(true);
      speak(speakable(first.text, 340, langRef.current), {
        lang: speechLang(langRef.current),
        onStart: () => { greetHeard.current = true; },
        onEnd: () => { speakingCount.current = Math.max(0, speakingCount.current - 1); if (!speakingCount.current) setSpeaking(false); },
      });
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); };
  }, [mode, voiceOn]);
  function muteToggle() {
    if (voiceOn) { stopSpeaking(); speakingCount.current = 0; setSpeaking(false); }
    setVoiceOn(!voiceOn);
  }
  function stopTalking() {
    stopSpeaking();
    speakingCount.current = 0;
    setSpeaking(false);
    setMicOn(false);
  }

  // First visit: show the greeting. If the home page sent a sentence or a sample story, send it as the first message.
  useEffect(() => {
    if (!guideRef.current.messages.length) setGuide((g) => ({ ...g, messages: [GREETING] }));
    else refreshPlan(guideRef.current.card).catch(() => {});
  }, [refreshPlan, setGuide]);
  const handledStart = useRef(null);
  useEffect(() => {
    const req = startProp || (location.state?.start ? { text: location.state.start, id: 'location' } : null);
    if (req && handledStart.current !== req.id) {
      handledStart.current = req.id;
      started.current = true;
      if (location.state?.start) navigate(location.pathname, { replace: true, state: null });
      turn({ message: req.text }, req.text);
    }
  }, [location, navigate, turn, startProp]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages.length, busy]);
  useEffect(() => {
    if (!busy && mode !== 'form' && mode !== 'talk') inputRef.current?.focus({ preventScroll: true });
  }, [busy, mode]);

  function submit(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    turn({ message: t }, t);
  }
  function tap(c) {
    if (busy) return;
    if (guide.awaiting === 'confirm') return turn({ action: c.value === 'confirm' ? 'confirm' : 'change' }, c.label);
    if (guide.complete && c.value === 'save') return save();
    if (guide.ask) return turn({ action: 'set', field: guide.ask.field, value: c.value }, c.label);
    return undefined;
  }
  const edit = (field, value) => turn({ action: 'set', field, value }, t('guide.edited', FIELD_LABELS[field]));

  async function save() {
    setBusy(true);
    setError('');
    try {
      const a = view.plan?.answers || answersFromCard(guide.card);
      await api.saveChecklist(a, (guide.card.values.desc || 'My business').slice(0, 80));
      navigate('/my-business');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  function useForm() {
    setAnswers(answersFromCard(guide.card));
    setLabel('');
    setCatsAuto(false);
    setStep(0);
    navigate('/questionnaire');
  }
  async function simulate() {
    setBusy(true);
    setError('');
    try {
      const r = await api.simulateRuleChange(guide.card);
      setSim(r);
      if (r.timelineAfter?.estimate) setView((v) => ({ ...v, timeline: r.timelineAfter }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function endSimulation() {
    setSim(null);
    await refreshPlan(guide.card, false).catch((e) => setError(e.message));
  }

  const chips = busy ? [] : guide.chips || [];
  const planCount = view.plan?.items?.length || 0;

  return (
    <div className={`guide-page${embedded ? " is-embedded" : ""}`}>
      <header className="guide-head">
        {!embedded && <GuideArt small />}
        <div>
          {embedded
            ? <h2 id="guide-title" tabIndex={-1}>{t('guide.title')}</h2>
            : <h1 id="guide-title" tabIndex={-1}>{t('guide.title')}</h1>}
          <p className="ai-label"><Icon name="chat" size={16} /> {t('guide.ai')}</p>
          {t('draft.note') && !embedded ? <p className="draft-note" role="note">{t('draft.note')}</p> : null}
        </div>
        {!embedded && <button type="button" className="btn btn-quiet btn-sm" onClick={useForm}>{t('guide.useForm')}</button>}
      </header>

      <div className="guide-tabs" role="tablist" aria-label={t('guide.sections')}>
        <button type="button" role="tab" id="tab-chat" aria-selected={tab === 'chat'} aria-controls="guide-chat" onClick={() => setTab('chat')}>{t('guide.tabChat')}</button>
        <button type="button" role="tab" id="tab-plan" aria-selected={tab === 'plan'} aria-controls="guide-side" onClick={() => setTab('plan')}>
          {t('guide.tabPlan')} <span className="tab-badge" aria-label={t('guide.steps', planCount)}>{planCount}</span>
        </button>
      </div>

      <div className="guide-grid">
        <section id="guide-chat" className={`guide-chat${tab === 'chat' ? ' is-active' : ''}`} data-tab="chat" aria-labelledby="guide-chat-title">
          <h2 id="guide-chat-title" className="sr-only">{t('guide.tabChat')}</h2>
          <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-label={t('guide.log')}>
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.role}`}>
                <span className="bubble-who">{m.role === 'guide' ? t('guide.guide') : t('guide.you')}</span>
                <p>{m.text}</p>
                {m.links?.length ? (
                  <ul className="bubble-links">
                    {m.links.map((l) => <li key={l.url}><ExternalLink href={l.url}>{l.label || l.url}</ExternalLink></li>)}
                  </ul>
                ) : null}
              </div>
            ))}
            {busy ? <div className="bubble guide" aria-busy="true"><span className="bubble-who">{t('guide.guide')}</span><p>{t('guide.notes')}</p></div> : null}
          </div>
          {chips.length ? (
            <ul className="tap-chips" aria-label={t('guide.quick')}>
              {chips.map((c) => (
                <li key={c.value}>
                  <button type="button" className={`tap-chip${c.value === 'confirm' || c.value === 'save' ? ' primary' : ''}`} onClick={() => tap(c)}>{c.label}</button>
                </li>
              ))}
            </ul>
          ) : null}
          <ErrorNote message={error} />
          <p className="captions" aria-hidden="true" data-testid="captions"><strong>{last.role === 'guide' ? t('guide.guide') : t('guide.you')}:</strong> {last.text}</p>
          <form className="mic-bar" onSubmit={submit}>
            <label htmlFor="guide-input" className="sr-only">{t('guide.inputLabel')}</label>
            <button
              type="button"
              className={`mic-btn${micOn ? ' is-on' : ''}`}
              aria-pressed={micOn}
              aria-label={micOn ? t('guide.micOn') : t('guide.micOff')}
              onClick={toggleMic}
            >
              <Icon name="mic" size={20} />
            </button>
            <input
              id="guide-input"
              ref={inputRef}
              type="text"
              value={text}
              maxLength={500}
              autoComplete="off"
              placeholder={t('guide.placeholder')}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>{t('guide.send')}</button>
          </form>
          <div className="voice-controls">
            <button type="button" className="btn btn-quiet btn-sm" onClick={muteToggle} aria-pressed={!voiceOn} disabled={!canSpeak()}>{voiceOn ? t('guide.mute') : t('guide.unmute')}</button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={stopTalking}>{t('guide.stop')}</button>
            <p className="voice-status" role="status">
              {voiceMsg || (t.lang === 'es' && voiceOn && canSpeak() && !hasVoice(speechLang(t.lang)) ? t('voice.noEs') : listening ? t('voice.listening') : speaking ? t('voice.speaking') : !canSpeak() ? t('voice.cannotSpeak') : voiceOn ? t('voice.on') : t('voice.off'))}
            </p>
          </div>
        </section>

        <section id="guide-side" className={`guide-side${tab === 'plan' ? ' is-active' : ''}`} data-tab="plan" aria-label={t('guide.sideLabel')}>
          <BusinessCard card={guide.card} onEdit={edit} disabled={busy} />
          <PlanPanel plan={view.plan} newIds={newIds} onSimulate={simulate} simulating={Boolean(sim)} busy={busy} />
          {guide.complete ? (
            <div className="save-box">
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{t('guide.save')}</button>
              <p className="hint">{t('guide.saveHint')}</p>
            </div>
          ) : null}
        </section>

      </div>

      <div className={`guide-road${tab === 'plan' ? ' is-active' : ''}`} data-tab="plan">
        <SimulatePanel result={sim} onClose={endSimulation} />
        <Timeline timeline={view.timeline} simulated={Boolean(sim)} />
        <p className="hint">{t('guide.checklistHint')} <Link to="/my-business">{t('guide.checklistLink')}</Link> {t('guide.checklistAfter')}</p>
      </div>
    </div>
  );
}
