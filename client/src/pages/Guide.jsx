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
import { canListen, canSpeak, createListener, hasVoice, isMuted, setMuted, listenErrorText, speak, speakable, stopSpeaking, synthBusy } from '../voice.js';
import { answersFromCard, confirmedCount, fieldsOf, isComplete } from '../guideCard.js';
import { speechLang, useT } from '../i18n.js';

// True when what the microphone heard is the guide's own voice coming back through the speakers. Single words are never
// matched against a pile of words: "LLC" said by the owner must not count just because the guide's text contains "LLC".
// One or two words are always the owner. A longer phrase is an echo when most of its word pairs appear in the guide's line.
const words = (x) => String(x).toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter(Boolean);
// How long the microphone stays off after the guide stops, so the end of its voice (and room echo) is not picked up.
export const QUIET_AFTER_SPEECH_MS = 500;
// The microphone switches itself off after this long with nobody speaking to the guide, so it never listens all day while the owner reads or scrolls.
export const MIC_IDLE_MS = 60000;
export function isEcho(heard, spoken) {
  const h = words(heard);
  if (!h.length) return true;
  const sp = words(spoken);
  if (h.length <= 2) return false; // an owner can answer with one or two words the guide just listed
  const pairs = new Set(sp.slice(0, -1).map((w, i) => `${w} ${sp[i + 1]}`));
  let hit = 0;
  for (let i = 0; i < h.length - 1; i += 1) if (pairs.has(`${h[i]} ${h[i + 1]}`)) hit += 1;
  return hit / (h.length - 1) >= 0.6;
}
// One or two words that are in the line the guide has just spoken, heard right after it stopped: its own voice coming back,
// not the owner. Yes and no are never echoes. The guide no longer reads out lists of choices, so a short answer rarely matches.
const YES_NO = new Set(['yes', 'no', 'yeah', 'yep', 'nope', 'sure', 'ok', 'okay', 'si', 'sí', 'claro']);
export function isLineEcho(heard, spoken) {
  const h = words(heard);
  if (!h.length || h.length > 2 || h.some((w) => YES_NO.has(w))) return false;
  const line = new Set(words(spoken));
  return h.every((w) => line.has(w));
}
const GREETING = { id: 'hello', role: 'guide', text: '' };
let counter = 0;
const nextId = () => `m${Date.now().toString(36)}${counter++}`;

const SAVE_RX = /^\s*(?:(?:ok|okay|yes|please|now|then|so)[\s,]+)*(?:save|keep|store)\b|\b(?:save|keep|store|open)\b[^.?!]{0,20}\b(?:plan|checklist)\b/i;
const SAVE_ES = /^\s*(?:(?:ok|okay|s[ií]|por favor|ahora|entonces|bueno)[\s,]+)*(?:guardar|guarda|guarde|conservar|conserva)(?![\p{L}])|(?<![\p{L}])(?:guardar|guarda|guarde|conservar|abrir)(?![\p{L}])[^.?!]{0,20}(?<![\p{L}])(?:plan|lista)(?![\p{L}])/iu;

// Main screen: the conversation on the left; the business card, the plan and the road to opening day fill in on the right.
// embedded: shown inside the home page. mode and start come from the home page's Talk / Type switch and its sentence box.
export default function Guide({ embedded = false, mode: modeProp, start: startProp, resync = 0 } = {}) {
  const { user, requireLogin, guide, setGuide, setLive, clearDraft, setAnswers, setLabel, setStep, setCatsAuto } = useApp();
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
  // The questions an admin added, and which standard ones were reworded or deleted. They are asked in the chat and listed on the card.
  const [extraQs, setExtraQs] = useState([]);
  const [standard, setStandard] = useState([]);
  const [qsLoaded, setQsLoaded] = useState(false);
  useEffect(() => { api.questions(t.lang).then((r) => { setExtraQs(r.questions || []); setStandard(r.standard || []); setQsLoaded(true); }).catch(() => setQsLoaded(true)); }, [t.lang]);
  const guideRef = useRef(guide);
  guideRef.current = guide;
  const seenIds = useRef(new Set());
  const inputRef = useRef(null);
  const logRef = useRef(null);
  const started = useRef(false);

  // Voice: the guide speaks its replies and the owner can talk back. It starts only after a tap (Talk to me, the microphone or Unmute).
  const [voiceOn, setVoiceOn] = useState(mode === 'talk' && canSpeak() && !isMuted());
  const [micOn, setMicOn] = useState(false);
  const [activity, setActivity] = useState(0); // bumped whenever the owner speaks or the guide finishes talking, to restart the idle timer
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState('');
  const [tick, setTick] = useState(0);
  const [hold, setHold] = useState(false); // the short quiet time after the guide stops, while its voice fades from the room
  const holdTimer = useRef(null);
  const prevMode = useRef(mode);
  // A returning visitor is not read the old conversation again, only the question that is waiting (the last guide line).
  const resumeIdx = (msgs) => (msgs.length > 1 ? (msgs[msgs.length - 1].role === 'guide' ? msgs.length - 1 : msgs.length) : 0);
  const spokenIdx = useRef(resync ? guide.messages.length : resumeIdx(guide.messages)); // after the form, the new next question is spoken, not the old one
  const greetHeard = useRef(false);
  const lastSpeechEnd = useRef(0);
  const guideHeard = () => speakingCount.current > 0 || Date.now() - lastSpeechEnd.current < 2500; // the tail of the guide's voice may still be in the air
  const spokenNow = useRef(''); // what the guide is saying now, so its own voice picked up by the microphone is not mistaken for the owner
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
      setGuide((g) => ({ ...g, messages: (!owner && g.messages.length && g.messages[g.messages.length - 1].role === 'guide' && g.messages[g.messages.length - 1].text === added[0].text) ? g.messages : [...g.messages, ...added], card: r.card, ask: r.ask, awaiting: r.awaiting, complete: r.complete, chips: r.chips || [] }));
      await refreshPlan(r.card, false);
      setSim(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [refreshPlan, setGuide]);

  turnRef.current = turn;
  // A card finished before an admin added (or deleted) a question picks up the change: the guide asks the new question, or finishes.
  useEffect(() => {
    if (!qsLoaded || busy) return;
    const done = isComplete(guide.card, fieldsOf(standard, extraQs));
    if (guide.complete && !done) turnRef.current({});
    else if (!guide.complete && done && guide.messages.length > 1) turnRef.current({});
  }, [qsLoaded, standard, extraQs, guide.complete, guide.card, guide.messages.length, busy]);
  // Switching Talk and Type on the home page: Talk turns the guide's voice on (the switch is the tap), Type turns voice and microphone off.
  useEffect(() => {
    if (prevMode.current === mode) return;
    prevMode.current = mode;
    if (mode === 'talk') {
      // Coming back to Talk part way through: say the question that is waiting (the next unanswered one), not nothing.
      const msgs = guideRef.current.messages;
      if (msgs.length > 1 && msgs[msgs.length - 1].role === 'guide') spokenIdx.current = msgs.length - 1;
      if (canSpeak()) setVoiceOn(true);
    } else {
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
    listenerRef.current?.stop(); // it starts again in the new language
    setTick((n) => n + 1);
    // The plan and the road come back from the server in the new language.
    refreshPlan(guideRef.current.card, false);
    if (guideRef.current.messages.length > 1) turnRef.current({}, null);
    // Only the greeting so far: say it again in the new language.
    else { spokenIdx.current = 0; greetHeard.current = false; setSpeakTick((n) => n + 1); }
  }, [t.lang]);
  saveRef.current = save;
  // Back from sign in with a finished card: save it straight away.
  const resumed = useRef(false);
  useEffect(() => {
    if (location.state?.resume === 'save' && user && guide.complete && !resumed.current) {
      resumed.current = true;
      navigate(location.pathname, { replace: true, state: null });
      saveRef.current();
    }
  });
  cond.current = { micOn, speaking, busy, hold };

  // The guide's voice has finished. The microphone stays off a moment longer so the tail of the voice is not heard as the owner.
  function speechDone() {
    speakingCount.current = Math.max(0, speakingCount.current - 1);
    if (speakingCount.current) return;
    lastSpeechEnd.current = Date.now();
    setActivity((n) => n + 1);
    setSpeaking(false);
    setHold(true);
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => { setHold(false); setTick((n) => n + 1); }, QUIET_AFTER_SPEECH_MS);
  }
  // Read each new guide line aloud, in order. Lines the owner typed or older lines are never read.
  useEffect(() => {
    if (!voiceOn) { spokenIdx.current = messages.length; return; }
    for (let i = spokenIdx.current; i < messages.length; i += 1) {
      if (messages[i].role !== 'guide') continue;
      speakingCount.current += 1;
      setSpeaking(true);
      const said = speakable(messages[i].text, 340, langRef.current); // exactly what is read aloud, so its echo can be recognised
      spokenNow.current = `${speakingCount.current > 1 ? spokenNow.current : ''} ${said}`;
      speak(said, {
        lang: speechLang(langRef.current),
        fadeIn: i === 0, // the greeting starts quietly and rises, so opening the page is never a sudden noise
        onStart: () => { greetHeard.current = true; },
        onSilent: () => setVoiceMsg(t('voice.silent')),
        onEnd: speechDone,
      });
    }
    spokenIdx.current = messages.length;
  }, [messages, voiceOn, speakTick]);

  // Take turns. The microphone listens only when the guide is neither thinking nor speaking (and for a moment after).
  // Listening while the guide talks made it hear its own voice from the speakers and answer itself.
  useEffect(() => {
    const l = listenerRef.current;
    if (micOn && !busy && !speaking && !hold && speakingCount.current === 0) {
      // The browser can announce the end of a line before the sound has finished. While it still says it is speaking, wait.
      if (synthBusy() && Date.now() - lastSpeechEnd.current < 6000) {
        l?.stop(); setListening(false);
        const again = setTimeout(() => setTick((n) => n + 1), 250);
        return () => clearTimeout(again);
      }
      l?.start(); setListening(true);
    } else { l?.stop(); setListening(false); }
    return undefined;
  }, [micOn, speaking, busy, hold, tick]);
  // Tell the home page's top banner what is happening, so the owner sees who is talking without scrolling down.
  const lastMsg = messages[messages.length - 1];
  const lastText = lastMsg?.text || '';
  const lastRole = lastMsg?.role || 'guide';
  useEffect(() => {
    if (!embedded) return;
    setLive({ speaking, listening, text: lastText, role: lastRole });
  }, [embedded, speaking, listening, lastText, lastRole, setLive]);
  useEffect(() => () => { if (embedded) setLive({ speaking: false, listening: false, text: '', role: 'guide' }); }, [embedded, setLive]);
  // On leaving the page, stop talking and listening. Resetting the counters also makes React's dev double-mount start the greeting again after its cancel.
  useEffect(() => () => { stopSpeaking(); clearTimeout(holdTimer.current); listenerRef.current?.stop(); spokenIdx.current = resumeIdx(guideRef.current.messages); speakingCount.current = 0; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function interrupt() {
    if (!speakingCount.current) return;
    stopSpeaking();
    speakingCount.current = 0;
    setSpeaking(false);
  }
  function ensureListener() {
    if (!canListen()) { setVoiceMsg(t('voice.cannotListen')); return false; }
    if (!listenerRef.current) {
      listenerRef.current = createListener({
        getLang: () => speechLang(langRef.current),
        onInterim: (t) => {
          if (speakingCount.current > 0) return; // the microphone is meant to be off while the guide talks: anything heard now is its own voice
          if (guideHeard() && (isEcho(t, spokenNow.current) || (Date.now() - lastSpeechEnd.current < 3000 && isLineEcho(t, spokenNow.current)))) return;
          interrupt(); // the owner is talking over the guide
          setActivity((n) => n + 1);
          setText(t);
        },
        onFinal: (t) => {
          if (speakingCount.current > 0) return;
          if (guideHeard() && (isEcho(t, spokenNow.current) || (Date.now() - lastSpeechEnd.current < 3000 && isLineEcho(t, spokenNow.current)))) return;
          interrupt();
          setActivity((n) => n + 1);
          setText('');
          turnRef.current({ message: t }, t);
        },
        onEnd: () => {
          setListening(false);
          const c = cond.current;
          if (c.micOn && !c.busy && !c.speaking && !c.hold && speakingCount.current === 0 && !synthBusy()) setTimeout(() => setTick((n) => n + 1), 120);
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
    if (!micOn && canSpeak() && !isMuted()) setVoiceOn(true); // a muted guide stays quiet even when the microphone is turned on
    setMicOn(!micOn);
  }
  // Talk mode opens with the greeting spoken and the microphone on, with no tap needed. If the browser holds the voice back
  // until the page has been touched, the first tap or key press anywhere says the greeting. If it also holds the microphone
  // back (no permission yet), the error text below the buttons says so and the microphone button still works.
  useEffect(() => {
    if (mode !== 'talk' || autoMic.current) return;
    autoMic.current = true;
    if (isMuted()) { setVoiceMsg(t('voice.mutedBoth')); return; } // muted earlier: stay quiet until Unmute
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
        fadeIn: true,
        onStart: () => { greetHeard.current = true; },
        onEnd: speechDone,
      });
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); };
  }, [mode, voiceOn]);
  // Do not keep listening forever. A microphone left open while the owner scrolls, reads or talks to someone else would send
  // that talk to the guide. It pauses after a minute of quiet, and at once when the tab is hidden.
  useEffect(() => {
    if (!micOn) return undefined;
    const idle = setTimeout(() => { setMicOn(false); setVoiceMsg(t('voice.pausedIdle')); }, MIC_IDLE_MS);
    return () => clearTimeout(idle);
  }, [micOn, activity]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!micOn) return undefined;
    const onHide = () => { if (document.hidden) { setMicOn(false); setVoiceMsg(t('voice.pausedHidden')); } };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [micOn]); // eslint-disable-line react-hooks/exhaustive-deps
  // Mute turns off sound both ways: the guide stops talking and the microphone stops listening. Unmute brings the microphone back
  // only if it was on before the owner muted.
  const micBeforeMute = useRef(false);
  function muteToggle() {
    if (voiceOn) {
      stopSpeaking(); speakingCount.current = 0; setSpeaking(false);
      setMuted(true);
      micBeforeMute.current = micOn;
      if (micOn) { setMicOn(false); listenerRef.current?.stop(); setListening(false); }
      setVoiceMsg(t('voice.mutedBoth'));
      setVoiceOn(false);
    } else {
      setMuted(false);
      setVoiceMsg('');
      setVoiceOn(true);
      if (micBeforeMute.current && ensureListener()) setMicOn(true);
      micBeforeMute.current = false;
    }
  }
  // Skip: end the guide's line now and go straight to listening. Nothing is left in the air, so no quiet time is needed.
  function skipTalking() {
    stopSpeaking();
    speakingCount.current = 0;
    clearTimeout(holdTimer.current);
    setHold(false);
    setSpeaking(false);
    setTick((n) => n + 1);
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
  const handledResync = useRef(0);
  useEffect(() => {
    if (!resync || handledResync.current === resync || !qsLoaded) return;
    handledResync.current = resync;
    turnRef.current({}); // the card now holds the form's answers: ask the next open question
  }, [resync, qsLoaded]);
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

  // "Edit answers" on My business lands here: scroll down to the Your business card so the rows are in view.
  const focusedBusiness = useRef(false);
  useEffect(() => {
    if (location.state?.focus !== 'business' || focusedBusiness.current) return undefined;
    // The card can appear a moment late (sign-in check, saved answers loading), so keep looking for about 4 seconds.
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const el = document.getElementById('guide-side');
      if (el && el.getBoundingClientRect().height > 0) {
        clearInterval(timer);
        focusedBusiness.current = true;
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      } else if (tries > 26) clearInterval(timer);
    }, 150);
    return () => clearInterval(timer);
  }, [location.state]);
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
  const edit = (field, value) => {
    const label = field.startsWith('x:') ? extraQs.find((q) => `x:${q.id}` === field)?.text : standard.find((s) => s.field === field)?.label || FIELD_LABELS[field];
    return turn({ action: 'set', field, value }, t('guide.edited', label || FIELD_LABELS[field] || ''));
  };

  async function save() {
    // Visitors can try everything first; the account is only needed to keep the plan.
    if (requireLogin && !user) return navigate('/login', { state: { from: '/guide', resume: 'save' } });
    setBusy(true);
    setError('');
    try {
      const a = view.plan?.answers || answersFromCard(guide.card);
      await api.saveBusiness(a, (guide.card.values.desc || 'My business').slice(0, 80));
      navigate('/my-business');
      clearDraft();
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
  // Before the owner has said anything, the home page shows a calm single conversation; the business card joins once there is something in it.
  const fresh = embedded && messages.length <= 1 && confirmedCount(guide.card) === 0;

  return (
    <div className={`guide-page${embedded ? " is-embedded" : ""}${fresh ? " is-fresh" : ""}`}>
      <header className={`guide-head${embedded ? ' sr-only' : ''}`}>
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

      {!embedded && <div className="guide-tabs" role="tablist" aria-label={t('guide.sections')}>
        <button type="button" role="tab" id="tab-chat" aria-selected={tab === 'chat'} aria-controls="guide-chat" onClick={() => setTab('chat')}>{t('guide.tabChat')}</button>
        <button type="button" role="tab" id="tab-plan" aria-selected={tab === 'plan'} aria-controls="guide-side" onClick={() => setTab('plan')}>
          {t('guide.tabPlan')} <span className="tab-badge" aria-label={t('guide.steps', planCount)}>{planCount}</span>
        </button>
      </div>}

      <div className="guide-grid">
        <section id="guide-chat" className={`guide-chat${tab === 'chat' ? ' is-active' : ''}`} data-tab="chat" aria-labelledby="guide-chat-title">
          <h2 id="guide-chat-title" className="sr-only">{t('guide.tabChat')}</h2>
          {embedded && (
            <div className="chat-id">
              <span className="chat-avatar"><Icon name="chat" size={18} /></span>
              <div><strong>{t('guide.title')}</strong><span>{t('guide.ai')}</span></div>
            </div>
          )}
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
            {speaking && <button type="button" className="btn btn-quiet btn-sm" onClick={skipTalking}>{t('guide.skip')}</button>}
            <button type="button" className="btn btn-quiet btn-sm" onClick={stopTalking}>{t('guide.stop')}</button>
            <p className={`voice-status${voiceMsg ? ' is-note' : ''}`} role="status">
              {voiceMsg || (t.lang === 'es' && voiceOn && canSpeak() && !hasVoice(speechLang(t.lang)) ? t('voice.noEs') : speaking ? t('voice.speaking') : listening ? t('voice.listening') : !canSpeak() ? t('voice.cannotSpeak') : voiceOn ? t('voice.on') : t('voice.off'))}
            </p>
          </div>
          {fresh && <p className="fresh-hint">{t('guide.freshHint')}</p>}
        </section>

        <section id="guide-side" className={`guide-side${tab === 'plan' ? ' is-active' : ''}`} data-tab="plan" aria-label={t('guide.sideLabel')}>
          <BusinessCard card={guide.card} onEdit={edit} disabled={busy} standard={standard} extraQs={extraQs} />
          {!embedded && <PlanPanel plan={view.plan} newIds={newIds} onSimulate={simulate} simulating={Boolean(sim)} busy={busy} />}
          {guide.complete ? (
            <div className="save-box">
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{t('guide.save')}</button>
              <p className="hint">{t('guide.saveHint')}</p>
            </div>
          ) : null}
        </section>

      </div>

      <div className={`guide-road${tab === 'plan' ? ' is-active' : ''}`} data-tab="plan">
        {!embedded && <SimulatePanel result={sim} onClose={endSimulation} />}
        {!embedded && <Timeline timeline={view.timeline} simulated={Boolean(sim)} />}
        {!embedded && <p className="hint">{t('guide.checklistHint')} <Link to="/my-business">{t('guide.checklistLink')}</Link> {t('guide.checklistAfter')}</p>}
      </div>
    </div>
  );
}
