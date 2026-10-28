import { useCallback, useEffect, useState } from 'react';

// Where the API lives. Empty in local dev (Vite proxies /api) and in the in-page preview.
// On Render the UI is a separate static site, so VITE_API_BASE_URL points at the API service.
const BASE = String(import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

// Anonymous browser id. Each browser gets its own saved checklist. No sign-up in v1.
let memoryId = '';
export function visitorId() {
  try {
    let id = localStorage.getItem('wa-visitor-id');
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() ?? `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem('wa-visitor-id', id);
    }
    return id;
  } catch {
    memoryId = memoryId || `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    return memoryId;
  }
}

// Admin key lives in sessionStorage only (cleared when the tab closes). It is never in the bundle.
let memoryKey = '';
export function getAdminKey() {
  try { return sessionStorage.getItem('wa-admin-key') || ''; } catch { return memoryKey; }
}
export function setAdminKey(key) {
  memoryKey = key;
  try { if (key) sessionStorage.setItem('wa-admin-key', key); else sessionStorage.removeItem('wa-admin-key'); } catch { /* memory only */ }
}

// The free host sleeps when idle. Tell the page when a request is slow so it can say so.
const SLOW_MS = 4000;
const emit = (name) => { try { globalThis.dispatchEvent?.(new Event(name)); } catch { /* no window */ } };

// Shown when the server or a proxy in front of it did not answer. No technical words.
const UNREACHABLE = 'We could not reach the server just now. Please try again in a moment.';

// The page language goes along as ?lang=es so rule text, guides and notes come back in Spanish.
let apiLang = 'en';
export const setApiLang = (l) => { apiLang = l === 'es' ? 'es' : 'en'; };

async function request(method, url, body) {
  if (apiLang === 'es' && !/[?&]lang=/.test(url) && !/^\/api\/(admin|rules|changes|county|source|demo)/.test(url)) url += `${url.includes('?') ? '&' : '?'}lang=es`;
  const headers = { 'content-type': 'application/json', 'x-visitor-id': visitorId() };
  const key = getAdminKey();
  if (key) headers['x-admin-key'] = key;
  const slow = setTimeout(() => emit('wa-api-slow'), SLOW_MS);
  let res;
  try {
    res = await fetch(`${BASE}${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    const e = new Error(UNREACHABLE);
    e.unreachable = true;
    throw e;
  } finally {
    clearTimeout(slow);
    emit('wa-api-done');
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok || data.ok === false) {
    const e = new Error(data.error || UNREACHABLE);
    e.status = res.status;
    e.unreachable = !data.error;
    throw e;
  }
  return data;
}

export const api = {
  samples: () => request('GET', '/api/samples'),
  suggest: (text) => request('POST', '/api/suggest', { text }),
  checklist: () => request('GET', '/api/checklist'),
  saveChecklist: (answers, label) => request('POST', '/api/checklist', { answers, label }),
  deleteChecklist: () => request('DELETE', '/api/checklist'),
  setDone: (ruleId, done) => request('PATCH', '/api/checklist/done', { ruleId, done }),
  setRenewal: (ruleId, date) => request('PUT', '/api/checklist/renewal', { ruleId, date }),
  dashboard: () => request('GET', '/api/dashboard'),
  notifications: () => request('GET', '/api/notifications'),
  markRead: (id) => request('POST', `/api/notifications/${id}/read`),
  renewalReminder: () => request('POST', '/api/notifications/renewal-reminder'),
  setEmailOptIn: (emailOptIn, email) => request('PUT', '/api/settings', { emailOptIn, email }),
  rules: () => request('GET', '/api/rules'),
  changes: () => request('GET', '/api/changes'),
  saveDraft: (id, fields) => request('PUT', `/api/rules/${id}/draft`, { fields }),
  discardDraft: (id) => request('DELETE', `/api/rules/${id}/draft`),
  publish: (id, reviewer) => request('POST', `/api/rules/${id}/publish`, { reviewer }),
  resetDemo: () => request('POST', '/api/demo/reset'),
  sourceReviews: (ruleId) => request('GET', `/api/source-reviews${ruleId ? `?ruleId=${encodeURIComponent(ruleId)}` : ''}`),
  addSourceReview: (review) => request('POST', '/api/source-reviews', review),
  countySources: () => request('GET', '/api/county-sources'),
  saveCountySource: (county, entry) => request('PUT', `/api/county-sources/${encodeURIComponent(county)}`, entry),
  adminStatus: () => request('GET', '/api/admin/status'),
  chat: (message, conversation, lang) => request('POST', '/api/chat', { message, conversation, lang }),
  intakeTurn: (body) => request('POST', '/api/intake/turn', body),
  intakePlan: (card, simulate = false) => request('POST', '/api/intake/plan', { card, simulate }),
  simulateRuleChange: (card) => request('POST', '/api/simulate/rule-change', { card }),
};

// Load data when a screen opens. reload() fetches again.
export function useLoad(fn) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    return fn()
      .then((data) => setState({ data, error: '', loading: false }))
      .catch((err) => setState({ data: null, error: err.message, loading: false }));
  }, [fn]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load, setData: (data) => setState({ data, error: '', loading: false }) };
}
