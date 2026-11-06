// Insights: counts only. No names, emails, answers, free text, visitor IDs or IP addresses are ever stored.
// Every event becomes a tick on a per-day counter, for example "plan_started|voice|en". Counters older than 90 days are dropped.
const KEEP_DAYS = 90;
// A group smaller than this is hidden, so no one can be picked out. Default 5.
// For a demo only, set INSIGHTS_MIN_GROUP=1 on the server (whole number 1 to 50), and set it back to 5 after.
const fromEnv = Number(process.env.INSIGHTS_MIN_GROUP);
export const MIN_GROUP = Number.isInteger(fromEnv) && fromEnv >= 1 && fromEnv <= 50 ? fromEnv : 5;
const MODES = ['voice', 'typing', 'form', 'sample'];
const LANGS = ['en', 'es'];
const STORAGE = ['device', 'link', 'account'];
const VALUES = ['yes', 'partly', 'no'];
export const REASONS = ['hard_words', 'too_long', 'missing_step', 'unsure_fit', 'other'];
const BLOCKED = ['denied', 'unsupported'];
const ID_RX = /^[a-z0-9_-]{1,40}$/i;
const SEC_BUCKET = 30; // seconds per bucket for "time to a plan"
const MAX_BUCKET = 60; // 30 minutes and over share the last bucket

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const oneOf = (v, list) => (list.includes(v) ? v : null);

// Turns an incoming event into counter keys, or null when it is not a valid event.
export function keysFor(ev) {
  const t = ev?.type;
  if (t === 'plan_started') {
    const mode = oneOf(ev.mode, MODES); const lang = oneOf(ev.lang, LANGS);
    return mode && lang ? [`plan_started|${mode}|${lang}`] : null;
  }
  if (t === 'question_answered' || t === 'question_left') return ID_RX.test(String(ev.question_id || '')) ? [`${t}|${ev.question_id}`] : null;
  if (t === 'plan_shown') {
    const n = Number(ev.step_count);
    if (!Number.isFinite(n) || n < 0 || n > 60) return null;
    if (ev.seconds === undefined || ev.seconds === null) return ['plan_shown']; // the step-by-step form has no start time to measure
    const sec = Number(ev.seconds);
    if (!Number.isFinite(sec) || sec < 0) return null;
    return ['plan_shown', `plan_shown_sec|${Math.min(MAX_BUCKET, Math.floor(sec / SEC_BUCKET))}`];
  }
  if (t === 'plan_saved') { const s = oneOf(ev.storage, STORAGE); return s ? [`plan_saved|${s}`] : null; }
  if (t === 'feedback') {
    const v = oneOf(ev.value, VALUES);
    if (!v) return null;
    const reasons = v === 'yes' ? [] : [...new Set((Array.isArray(ev.reasons) ? ev.reasons : []).filter((r) => REASONS.includes(r)))];
    return [`feedback|${v}`, ...reasons.map((r) => `feedback_reason|${v}|${r}`)];
  }
  if (t === 'step_done') return ID_RX.test(String(ev.step_id || '')) ? [`step_done|${ev.step_id}`] : null;
  if (t === 'voice_blocked') { const r = oneOf(ev.reason, BLOCKED); return r ? [`voice_blocked|${r}`] : null; }
  return null;
}

export function createInsights(store) {
  let chain = Promise.resolve();
  const load = async () => (await store.getAppConfig('insights')) || { days: {} };

  function record(ev, now = new Date()) {
    const keys = keysFor(ev);
    if (!keys) return Promise.resolve(false);
    chain = chain.then(async () => {
      const doc = await load();
      const days = doc.days || {};
      const d = day(now);
      days[d] = days[d] || {};
      for (const k of keys) days[d][k] = (days[d][k] || 0) + 1;
      const cutoff = day(new Date(now.getTime() - KEEP_DAYS * 86400000));
      for (const k of Object.keys(days)) if (k < cutoff) delete days[k];
      await store.putAppConfig('insights', { days });
    }).catch(() => {});
    return chain.then(() => true);
  }

  // Adds up the last `span` days.
  async function totals(span, now = new Date()) {
    const doc = await load();
    const since = day(new Date(now.getTime() - (span - 1) * 86400000));
    const sum = {}; const daily = [];
    for (const [d, counters] of Object.entries(doc.days || {}).sort()) {
      if (d < since) continue;
      for (const [k, n] of Object.entries(counters)) sum[k] = (sum[k] || 0) + n;
      daily.push({ day: d, started: Object.entries(counters).filter(([k]) => k.startsWith('plan_started|')).reduce((a, [, n]) => a + n, 0), shown: counters.plan_shown || 0, saved: Object.entries(counters).filter(([k]) => k.startsWith('plan_saved|')).reduce((a, [, n]) => a + n, 0) });
    }
    return { sum, daily, since };
  }
  return { record, totals };
}

// A count below the minimum group size is hidden.
export const hide = (n) => (n < MIN_GROUP ? null : n);

export function median(sum) {
  const rows = [];
  for (let b = 0; b <= MAX_BUCKET; b += 1) { const n = sum[`plan_shown_sec|${b}`] || 0; if (n) rows.push([b, n]); }
  const total = rows.reduce((a, [, n]) => a + n, 0);
  if (total < MIN_GROUP) return { total, seconds: null };
  let seen = 0;
  for (const [b, n] of rows) { seen += n; if (seen >= total / 2) return { total, seconds: b * SEC_BUCKET + SEC_BUCKET / 2 }; }
  return { total, seconds: null };
}
