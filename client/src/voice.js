// Voice for the guide, using the browser's own speech features. Nothing is recorded or sent to our server:
// the browser turns speech into text and the text goes to the guide like typed words. Chrome and Edge send the audio to
// their own speech service to do this, so it needs an internet connection. Voice never starts until the owner taps.

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
export const recognitionClass = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);
export const canListen = () => Boolean(recognitionClass());

// Prefer a voice installed on the computer. Chrome's network voices ("Google ...") are known to go silent after the first line or on longer text.
function pickVoice() {
  const voices = window.speechSynthesis.getVoices?.() || [];
  const en = voices.filter((v) => /^en[-_]US/i.test(v.lang));
  const local = en.filter((v) => v.localService !== false && !/google/i.test(v.name));
  return local.find((v) => /aria|jenny|zira|samantha|natural/i.test(v.name)) || local[0]
    || en.find((v) => !/google/i.test(v.name)) || voices.find((v) => /^en/i.test(v.lang) && !/google/i.test(v.name)) || en[0] || null;
}

// What gets read aloud is shorter than what is on screen: no agency names in brackets, no "source checked" footers, at most about
// three sentences. The full text stays on screen and in the captions, so nothing is lost.
export function speakable(text, max = 340) {
  const lines = String(text || '').split(/\n+/).map((l) => l.trim()).filter((l) => l && !/^(source checked|these are the agency|not yet approved|confirm with the agency|related steps|steps:|\d+\.|-\s)/i.test(l));
  let t = lines.join(' ').replace(/^(?:got it|thank you|thanks|no problem)[.!]\s+(?=\S)/i, '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').replace(/\bL&I\b/g, 'L and I').replace(/\bDOR\b/g, 'D O R').replace(/\bUBI\b/g, 'U B I').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return (end > 80 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '.').trim();
}

// Speak one line. Lines queue up, so a reply and its follow-up question are read in order.
export function speak(text, { onStart, onEnd, onSilent } = {}) {
  if (!canSpeak() || !text) return;
  let done = false;
  let started = false;
  let timer = null;
  let check = null;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    clearTimeout(check);
    onEnd?.();
  };
  const say = (retry) => {
    const u = new window.SpeechSynthesisUtterance(String(text));
    u.lang = 'en-US';
    u.rate = 1.08;
    const v = pickVoice();
    if (v) u.voice = v;
    u.onstart = () => { started = true; onStart?.(); };
    u.onend = finish;
    u.onerror = (e) => { if (e?.error === 'interrupted' || e?.error === 'canceled') finish(); else if (!retry) say(true); else finish(); };
    // A browser that was left paused will accept a line and never play it.
    try { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); } catch { /* ignore */ }
    window.speechSynthesis.speak(u);
    // If nothing started and nothing is queued, the line was silently dropped: try once more, then say so.
    check = setTimeout(() => {
      const synth = window.speechSynthesis;
      if (done || started || synth.speaking || synth.pending) return;
      if (!retry) { try { synth.cancel(); } catch { /* ignore */ } setTimeout(() => say(true), 150); } else { onSilent?.(); finish(); }
    }, 2500);
  };
  // Some browsers never send the "end" event for a line. Without it the microphone would stay switched off, so a timer
  // closes the line after a generous estimate of how long it takes to say.
  timer = setTimeout(finish, 6000 + String(text).length * 110);
  say(false);
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
  let delivered = false;
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i += 1) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim) onInterim?.(interim);
    // Hand the sentence over as soon as the browser is sure of it, instead of waiting for it to close the microphone.
    const t = finalText.trim();
    if (t && !delivered) {
      delivered = true;
      finalText = '';
      onFinal?.(t);
      try { rec.stop(); } catch { /* already stopped */ }
    }
  };
  rec.onerror = (e) => { onError?.(e.error); };
  rec.onend = () => {
    running = false;
    const t = finalText.trim();
    finalText = '';
    if (t && !delivered) onFinal?.(t);
    const had = delivered || Boolean(t);
    delivered = false;
    onEnd?.(had);
  };
  return {
    start() {
      if (running) return;
      finalText = '';
      delivered = false;
      try { rec.start(); running = true; } catch { running = false; }
    },
    stop() {
      if (!running) return;
      try { rec.abort(); } catch { /* already stopped */ }
      running = false;
    },
  };
}
