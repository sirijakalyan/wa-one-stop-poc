// Voice for the guide, using the browser's own speech features. Nothing is recorded or sent to our server:
// the browser turns speech into text and the text goes to the guide like typed words. Chrome and Edge send the audio to
// their own speech service to do this, so it needs an internet connection. Voice never starts until the owner taps.

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
export const recognitionClass = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);
export const canListen = () => Boolean(recognitionClass());

function pickVoice() {
  const voices = window.speechSynthesis.getVoices?.() || [];
  const en = voices.filter((v) => /^en[-_]US/i.test(v.lang));
  return en.find((v) => /natural|online|google|samantha|aria|jenny/i.test(v.name)) || en[0] || voices.find((v) => /^en/i.test(v.lang)) || null;
}

// Speak one line. Lines queue up, so a reply and its follow-up question are read in order.
export function speak(text, { onStart, onEnd } = {}) {
  if (!canSpeak() || !text) return;
  const u = new window.SpeechSynthesisUtterance(String(text));
  u.lang = 'en-US';
  u.rate = 1;
  const v = pickVoice();
  if (v) u.voice = v;
  u.onstart = () => onStart?.();
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

const ERRORS = {
  'not-allowed': 'The microphone is blocked. Allow it in your browser, or type instead.',
  'service-not-allowed': 'The microphone is blocked. Allow it in your browser, or type instead.',
  'audio-capture': 'No microphone was found. Check that one is connected, or type instead.',
  network: 'Voice input needs an internet connection and could not reach the speech service. Type instead.',
};
export const listenErrorText = (code) => ERRORS[code] || '';

// One listener. start() begins one round of listening and ends by itself after the owner pauses.
export function createListener({ onInterim, onFinal, onEnd, onError }) {
  const Rec = recognitionClass();
  if (!Rec) return null;
  const rec = new Rec();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let running = false;
  let finalText = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i += 1) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim) onInterim?.(interim);
  };
  rec.onerror = (e) => { onError?.(e.error); };
  rec.onend = () => {
    running = false;
    const t = finalText.trim();
    finalText = '';
    if (t) onFinal?.(t);
    onEnd?.(Boolean(t));
  };
  return {
    start() {
      if (running) return;
      finalText = '';
      try { rec.start(); running = true; } catch { running = false; }
    },
    stop() {
      if (!running) return;
      try { rec.abort(); } catch { /* already stopped */ }
      running = false;
    },
  };
}
