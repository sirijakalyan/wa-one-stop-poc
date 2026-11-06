// Sends small count events to the server's Insights. Each event is a type and a short code. Never answers, names, emails or free text.
// The start time stays in this tab (session storage) and is sent only as "seconds since the first message".
import { BASE_URL, authHeaders } from './api.js';

const KEY = 'wa-ins';
const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = (v) => { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage may be blocked */ } };

export function track(type, fields = {}) {
  try {
    fetch(`${BASE_URL}/api/insights/event`, { method: 'POST', keepalive: true, headers: authHeaders(), body: JSON.stringify({ type, ...fields }) }).catch(() => {});
  } catch { /* counting must never get in the way */ }
}

// One plan at a time: started once, shown once, until it is saved or the owner starts over.
export function planStarted(mode, lang) {
  const s = read();
  if (s.at) return;
  write({ at: Date.now() });
  track('plan_started', { mode, lang });
}
export function planShown(stepCount, timed = true) {
  const s = read();
  if (!s.at || s.shown) return;
  write({ ...s, shown: true });
  track('plan_shown', { step_count: Math.max(0, Math.min(60, stepCount || 0)), ...(timed ? { seconds: Math.round((Date.now() - s.at) / 1000) } : {}) });
}
export function questionAnswered(id) {
  const s = read();
  if (!s.at) return;
  const done = s.answered || [];
  if (done.includes(id)) return;
  write({ ...s, answered: [...done, id] });
  track('question_answered', { question_id: id });
}
// The owner closed or left the page before the plan appeared: counted against the question they were on.
export function leftEarly(id) {
  const s = read();
  if (!s.at || s.shown || s.left) return;
  write({ ...s, left: true });
  track('question_left', { question_id: id || 'start' });
}
export function planSaved(storage) {
  track('plan_saved', { storage });
  write({});
}
export function resetPlan() { write({}); }
export const feedbackGiven = (bizKey) => { try { return Boolean(localStorage.getItem(`wa-fb-${bizKey}`)); } catch { return true; } };
export const rememberFeedback = (bizKey) => { try { localStorage.setItem(`wa-fb-${bizKey}`, '1'); } catch { /* ignore */ } };
