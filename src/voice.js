// Voice for the guide, using the browser's own speech features. Nothing is recorded or sent to our server:
// the browser turns speech into text and the text goes to the guide like typed words. Chrome and Edge send the audio to
// their own speech service to do this, so it needs an internet connection. Voice never starts until the owner taps.

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
export const recognitionClass = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);
export const canListen = () => Boolean(recognitionClass());

// Prefer a voice installed on the computer. Chrome's network voices ("Google ...") are known to go silent after the first line or on longer text.
function pickVoice(lang = 'en-US') {
  const voices = window.speechSynthesis.getVoices?.() || [];
  const base = String(lang).slice(0, 2).toLowerCase();
  if (base === 'es') {
    const es = voices.filter((v) => /^es/i.test(v.lang));
    const local = es.filter((v) => v.localService !== false && !/google/i.test(v.name));
    // Mexican and US Spanish first, then any other Spanish.
    return local.find((v) => /^es[-_](US|MX)/i.test(v.lang)) || local[0] || es.find((v) => !/google/i.test(v.name)) || es[0] || null;
  }
  const en = voices.filter((v) => /^en[-_]US/i.test(v.lang));
  const local = en.filter((v) => v.localService !== false && !/google/i.test(v.name));
  return local.find((v) => /aria|jenny|zira|samantha|natural/i.test(v.name)) || local[0]
    || en.find((v) => !/google/i.test(v.name)) || voices.find((v) => /^en/i.test(v.lang) && !/google/i.test(v.name)) || en[0] || null;
}

// What gets read aloud is shorter than what is on screen: no agency names in brackets, no "source checked" footers, at most about
// three sentences. The full text stays on screen and in the captions, so nothing is lost.
export function speakable(text, max = 340, lang = 'en') {
  // A Spanish answer that carries English agency text is not read aloud in a Spanish voice: it points to the screen instead.
  if (lang === 'es' && /por ahora están en inglés:/.test(String(text || ''))) return 'Encontré la respuesta en las reglas oficiales, que por ahora están en inglés. Puede leerla en la pantalla.';
  const lines = String(text || '').split(/\n+/).map((l) => l.trim()).filter((l) => l && !/^(source checked|these are the agency|not yet approved|confirm with the agency|related steps|steps:|\d+\.|-\s)/i.test(l));
  let t = lines.join(' ').replace(/^(?:got it|thank you|thanks|no problem|entendido|gracias|está bien)[.!]\s+(?=\S)/i, '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').replace(/\bL&I\b/g, lang === 'es' ? 'L y I' : 'L and I').replace(/\bDOR\b/g, 'D O R').replace(/\bUBI\b/g, 'U B I').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return (end > 80 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '.').trim();
}

// Chrome drops a line spoken right after cancel(), and a cancelled network voice can leave its queue stuck with speaking === true
// and no sound. So: wait a moment after any cancel, and if a line has not started, reset the queue and try again with the same
// voice, then with no chosen voice at all (the browser's own default for the language).
let lastCancelAt = 0;
let lastStartAt = 0;

// Speak one line. Lines queue up, so a reply and its follow-up question are read in order.
export function speak(text, { onStart, onEnd, onSilent, lang = 'en-US' } = {}) {
  if (!canSpeak() || !text) return;
  let done = false;
  let started = false;
  let timer = null;
  let check = null;
  let current = null;
  const synth = () => window.speechSynthesis;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    clearTimeout(check);
    onEnd?.();
  };
  const reset = () => { try { synth().cancel(); } catch { /* ignore */ } lastCancelAt = Date.now(); };
  const say = (attempt) => {
    if (done) return;
    const u = new window.SpeechSynthesisUtterance(String(text));
    u.lang = lang;
    u.rate = 1.08;
    current = u;
    const v = attempt < 2 ? pickVoice(lang) : null;
    if (v) u.voice = v;
    u.onstart = () => { if (u !== current) return; started = true; lastStartAt = Date.now(); onStart?.(); };
    u.onend = () => { if (u === current) finish(); };
    u.onerror = (e) => { if (u !== current) return; if (e?.error === 'interrupted' || e?.error === 'canceled') finish(); else if (attempt < 2) { reset(); setTimeout(() => say(attempt + 1), 300); } else finish(); };
    // A browser that was left paused will accept a line and never play it.
    try { if (synth().paused) synth().resume(); } catch { /* ignore */ }
    try { synth().speak(u); } catch { /* a browser that refuses to speak must not break the page */ }
    // Not started after a few seconds and nothing else of ours started either: the queue is stuck, whatever speaking says.
    check = setTimeout(() => {
      if (done || started || Date.now() - lastStartAt < 3000) return;
      if (attempt < 2) { reset(); setTimeout(() => say(attempt + 1), 300); } else { onSilent?.(); finish(); }
    }, 3000);
  };
  // Some browsers never send the "end" event for a line. Without it the microphone would stay switched off, so a timer
  // closes the line after a generous estimate of how long it takes to say.
  timer = setTimeout(finish, 9000 + String(text).length * 110);
  const wait = Math.max(0, 300 - (Date.now() - lastCancelAt));
  if (wait) setTimeout(() => say(0), wait); else say(0);
}

// False only when the browser has loaded its voice list and none of them speaks this language. An empty list means not loaded yet.
export function hasVoice(lang = 'en-US') {
  if (!canSpeak()) return false;
  const voices = window.speechSynthesis.getVoices?.() || [];
  if (!voices.length) return true;
  const base = String(lang).slice(0, 2).toLowerCase();
  return voices.some((v) => String(v.lang).toLowerCase().startsWith(base));
}

export function stopSpeaking() {
  if (canSpeak()) { window.speechSynthesis.cancel(); lastCancelAt = Date.now(); }
}

const ERRORS = {
  'not-allowed': 'The microphone is blocked. Allow it in your browser, or type instead.',
  'service-not-allowed': 'The microphone is blocked. Allow it in your browser, or type instead.',
  'audio-capture': 'No microphone was found. Check that one is connected, or type instead.',
  network: 'Voice input needs an internet connection and could not reach the speech service. Type instead.',
};
const ERRORS_ES = {
  'not-allowed': 'El micrófono está bloqueado. Permítalo en su navegador, o escriba.',
  'service-not-allowed': 'El micrófono está bloqueado. Permítalo en su navegador, o escriba.',
  'audio-capture': 'No se encontró ningún micrófono. Revise que haya uno conectado, o escriba.',
  network: 'La entrada de voz necesita internet y no pudo conectarse al servicio de voz. Escriba.',
  'language-not-supported': 'Este navegador no reconoce voz en español. Escriba su respuesta.',
};
export const listenErrorText = (code, lang = 'en') => (lang === 'es' ? ERRORS_ES : ERRORS)[code] || '';

// One listener. start() begins one round of listening and ends by itself after the owner pauses.
export function createListener({ onInterim, onFinal, onEnd, onError, getLang = () => 'en-US' }) {
  const Rec = recognitionClass();
  if (!Rec) return null;
  const rec = new Rec();
  rec.lang = getLang();
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
      rec.lang = getLang();
      try { rec.start(); running = true; } catch { running = false; }
    },
    stop() {
      if (!running) return;
      try { rec.abort(); } catch { /* already stopped */ }
      running = false;
    },
  };
}
