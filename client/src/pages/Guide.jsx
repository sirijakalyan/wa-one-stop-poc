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
import { canListen, canSpeak, createListener, listenErrorText, speak, speakable, stopSpeaking } from '../voice.js';
import { answersFromCard, confirmedCount, FIELD_LABELS } from '../guideCard.js';

const GREETING = { id: 'hello', role: 'guide', text: "Hi, I'm here to help you start your Washington business. Tell me what you want to do, in your own words." };
let counter = 0;
const nextId = () => `m${Date.now().toString(36)}${counter++}`;

// Main screen: the conversation on the left; the business card, the plan and the road to opening day fill in on the right.
export default function Guide() {
  const { guide, setGuide, setAnswers, setLabel, setStep, setCatsAuto } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode] = useState(location.state?.mode || 'type');
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
  const spokenIdx = useRef(0);
  const speakingCount = useRef(0);
  const listenerRef = useRef(null);
  const cond = useRef({});
  const turnRef = useRef(null);

  const messages = guide.messages.length ? guide.messages : [GREETING];
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
    setBusy(true);
    setError('');
    const owner = ownerText ? { id: nextId(), role: 'owner', text: ownerText } : null;
    setGuide((g) => ({ ...g, messages: [...(g.messages.length ? g.messages : [GREETING]), ...(owner ? [owner] : [])] }));
    try {
      const cur = guideRef.current;
      const r = await api.intakeTurn({ card: cur.card, asking: cur.ask?.field, ...body });
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
  cond.current = { micOn, speaking, busy };

  // Read each new guide line aloud, in order. Lines the owner typed or older lines are never read.
  useEffect(() => {
    if (!voiceOn) { spokenIdx.current = messages.length; return; }
    for (let i = spokenIdx.current; i < messages.length; i += 1) {
      if (messages[i].role !== 'guide') continue;
      speakingCount.current += 1;
      setSpeaking(true);
      speak(speakable(messages[i].text), {
        onEnd: () => {
          speakingCount.current = Math.max(0, speakingCount.current - 1);
          if (!speakingCount.current) setSpeaking(false);
        },
      });
    }
    spokenIdx.current = messages.length;
  }, [messages, voiceOn]);

  // Listen only while the microphone is on and the guide is neither speaking nor thinking, so it never hears itself.
  useEffect(() => {
    const l = listenerRef.current;
    if (micOn && !speaking && !busy) { l?.start(); setListening(true); } else { l?.stop(); setListening(false); }
  }, [micOn, speaking, busy, tick]);
  // On leaving the page, stop talking and listening. Resetting the counters also makes React's dev double-mount start the greeting again after its cancel.
  useEffect(() => () => { stopSpeaking(); listenerRef.current?.stop(); spokenIdx.current = 0; speakingCount.current = 0; }, []);

  function toggleMic() {
    setVoiceMsg('');
    if (!canListen()) { setVoiceMsg('This browser cannot listen. Use Chrome or Edge, or type your answer.'); return; }
    if (!listenerRef.current) {
      listenerRef.current = createListener({
        onInterim: (t) => setText(t),
        onFinal: (t) => { setText(''); turnRef.current({ message: t }, t); },
        onEnd: () => {
          setListening(false);
          const c = cond.current;
          if (c.micOn && !c.speaking && !c.busy) setTimeout(() => setTick((n) => n + 1), 400);
        },
        onError: (code) => {
          const msg = listenErrorText(code);
          if (msg) { setVoiceMsg(msg); setMicOn(false); }
        },
      });
    }
    if (!micOn && canSpeak()) setVoiceOn(true);
    setMicOn(!micOn);
  }
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
  useEffect(() => {
    const start = location.state?.start;
    if (start && !started.current) {
      started.current = true;
      navigate(location.pathname, { replace: true, state: null });
      turn({ message: start }, start);
    }
  }, [location, navigate, turn]);

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
  const edit = (field, value) => turn({ action: 'set', field, value }, `I changed "${FIELD_LABELS[field]}".`);

  async function save() {
    setBusy(true);
    setError('');
    try {
      const a = view.plan?.answers || answersFromCard(guide.card);
      await api.saveChecklist(a, (guide.card.values.desc || 'My business').slice(0, 80));
      navigate('/checklist');
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
    <div className="guide-page">
      <header className="guide-head">
        <GuideArt small />
        <div>
          <h1 id="guide-title" tabIndex={-1}>Your guide</h1>
          <p className="ai-label"><Icon name="chat" size={16} /> You&apos;re talking to an AI guide. Written rules decide your plan; the guide only listens and asks.</p>
        </div>
        <button type="button" className="btn btn-quiet btn-sm" onClick={useForm}>Use the step-by-step form instead</button>
      </header>

      <div className="guide-tabs" role="tablist" aria-label="Guide sections">
        <button type="button" role="tab" id="tab-chat" aria-selected={tab === 'chat'} aria-controls="guide-chat" onClick={() => setTab('chat')}>Conversation</button>
        <button type="button" role="tab" id="tab-plan" aria-selected={tab === 'plan'} aria-controls="guide-side" onClick={() => setTab('plan')}>
          Plan <span className="tab-badge" aria-label={`${planCount} steps`}>{planCount}</span>
        </button>
      </div>

      <div className="guide-grid">
        <section id="guide-chat" className={`guide-chat${tab === 'chat' ? ' is-active' : ''}`} data-tab="chat" aria-labelledby="chat-title">
          <h2 id="chat-title" className="sr-only">Conversation</h2>
          <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-label="Conversation with the guide">
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.role}`}>
                <span className="bubble-who">{m.role === 'guide' ? 'Guide' : 'You'}</span>
                <p>{m.text}</p>
                {m.links?.length ? (
                  <ul className="bubble-links">
                    {m.links.map((l) => <li key={l.url}><ExternalLink href={l.url}>{l.label || l.url}</ExternalLink></li>)}
                  </ul>
                ) : null}
              </div>
            ))}
            {busy ? <div className="bubble guide" aria-busy="true"><span className="bubble-who">Guide</span><p>Taking notes...</p></div> : null}
          </div>
          {chips.length ? (
            <ul className="tap-chips" aria-label="Quick answers">
              {chips.map((c) => (
                <li key={c.value}>
                  <button type="button" className={`tap-chip${c.value === 'confirm' || c.value === 'save' ? ' primary' : ''}`} onClick={() => tap(c)}>{c.label}</button>
                </li>
              ))}
            </ul>
          ) : null}
          <ErrorNote message={error} />
          <p className="captions" aria-hidden="true" data-testid="captions"><strong>{last.role === 'guide' ? 'Guide' : 'You'}:</strong> {last.text}</p>
          <form className="mic-bar" onSubmit={submit}>
            <label htmlFor="guide-input" className="sr-only">Tell the guide about your business, or answer its question</label>
            <button
              type="button"
              className={`mic-btn${micOn ? ' is-on' : ''}`}
              aria-pressed={micOn}
              aria-label={micOn ? 'Microphone on. Tap to turn it off.' : 'Microphone off. Tap to talk.'}
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
              placeholder="Type here, for example: I want to open a food truck in Spokane"
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>Send</button>
          </form>
          <div className="voice-controls">
            <button type="button" className="btn btn-quiet btn-sm" onClick={muteToggle} aria-pressed={!voiceOn} disabled={!canSpeak()}>{voiceOn ? 'Mute voice' : 'Unmute voice'}</button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={stopTalking}>Stop</button>
            <p className="voice-status" role="status">
              {voiceMsg || (listening ? 'Listening. Speak now.' : speaking ? 'The guide is speaking.' : !canSpeak() ? 'This browser cannot speak. Captions and typing still work.' : voiceOn ? 'Voice is on. Tap the microphone to talk.' : 'Voice is off. Tap the microphone or Unmute voice.')}
            </p>
          </div>
        </section>

        <section id="guide-side" className={`guide-side${tab === 'plan' ? ' is-active' : ''}`} data-tab="plan" aria-label="Your business and your plan">
          <BusinessCard card={guide.card} onEdit={edit} disabled={busy} />
          <PlanPanel plan={view.plan} newIds={newIds} onSimulate={simulate} simulating={Boolean(sim)} busy={busy} />
          {guide.complete ? (
            <div className="save-box">
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>Save my plan and open my checklist</button>
              <p className="hint">Saves your confirmed answers for this browser. You can mark steps done on the checklist, which is simulated tracking.</p>
            </div>
          ) : null}
        </section>

      </div>

      <div className={`guide-road${tab === 'plan' ? ' is-active' : ''}`} data-tab="plan">
        <SimulatePanel result={sim} onClose={endSimulation} />
        <Timeline timeline={view.timeline} simulated={Boolean(sim)} />
        <p className="hint">Need the full checklist later? <Link to="/checklist">Open My checklist</Link> after you save your plan.</p>
      </div>
    </div>
  );
}
