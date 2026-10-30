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

// Which saved business this browser is looking at ('main' is the first one). Sent as ?biz= on the checklist, dashboard and chat calls.
let memoryBiz = 'main';
export function getBusiness() {
  try { return localStorage.getItem('wa-biz') || memoryBiz; } catch { return memoryBiz; }
}
export function setBusiness(id) {
  memoryBiz = id || 'main';
  try { if (id && id !== 'main') localStorage.setItem('wa-biz', id); else localStorage.removeItem('wa-biz'); } catch { /* memory only */ }
}
// Set by "Edit answers": the next save replaces this business instead of adding a new one.
let editingBiz = '';
export const startEditing = (id) => { editingBiz = id || ''; };
export const stopEditing = () => { editingBiz = ''; };

// Admin key lives in sessionStorage only (cleared when the tab closes). It is never in the bundle.
let memoryKey = '';
export function getAdminKey() {
  try { return sessionStorage.getItem('wa-admin-key') || ''; } catch { return memoryKey; }
}
export function setAdminKey(key) {
  memoryKey = key;
  try { if (key) sessionStorage.setItem('wa-admin-key', key); else sessionStorage.removeItem('wa-admin-key'); } catch { /* memory only */ }
}

// Sign-in token. Kept in this browser (localStorage) so a refresh keeps you signed in. The server stores only a hash of it.
let memorySession = '';
let memoryRefresh = '';
export function getSession() {
  try { return localStorage.getItem('wa-session') || memorySession; } catch { return memorySession; }
}
export function getRefreshToken() {
  try { return localStorage.getItem('wa-refresh') || memoryRefresh; } catch { return memoryRefresh; }
}
export function setSession(token, refreshToken) {
  memorySession = token || '';
  if (refreshToken !== undefined || !token) memoryRefresh = token ? (refreshToken || '') : '';
  try {
    if (token) localStorage.setItem('wa-session', token); else localStorage.removeItem('wa-session');
    if (!token) localStorage.removeItem('wa-refresh');
    else if (refreshToken) localStorage.setItem('wa-refresh', refreshToken);
  } catch { /* memory only */ }
}

// The free host sleeps when idle. Tell the page when a request is slow so it can say so.
const SLOW_MS = 4000;
const emit = (name) => { try { globalThis.dispatchEvent?.(new Event(name)); } catch { /* no window */ } };

// Shown when the server or a proxy in front of it did not answer. No technical words.
const UNREACHABLE = 'We could not reach the server just now. Please try again in a moment.';

// The page language goes along as ?lang=es so rule text, guides and notes come back in Spanish.
let apiLang = 'en';
export const setApiLang = (l) => { apiLang = l === 'es' ? 'es' : 'en'; };

// With AWS Cognito the sign-in token lasts an hour. When the server says it ran out, trade the refresh token for a new one
// once and repeat the request. If that fails, the person is signed out (the page hears 'wa-session-expired').
let refreshing = null;
async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  refreshing = refreshing || fetch(`${BASE}/api/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }) })
    .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok || !d.token) return false; setSession(d.token, refreshToken); return true; })
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function request(method, url, body, retried = false) {
  const biz = getBusiness();
  if (biz && biz !== 'main' && /^\/api\/(checklist|dashboard|chat)/.test(url) && !/[?&]biz=/.test(url)) url += `${url.includes('?') ? '&' : '?'}biz=${encodeURIComponent(biz)}`;
  if (apiLang === 'es' && !/[?&]lang=/.test(url) && !/^\/api\/(admin|rules|changes|county|source|demo)/.test(url)) url += `${url.includes('?') ? '&' : '?'}lang=es`;
  const headers = { 'content-type': 'application/json', 'x-visitor-id': visitorId() };
  const key = getAdminKey();
  if (key) headers['x-admin-key'] = key;
  const session = getSession();
  if (session) headers.authorization = `Bearer ${session}`;
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
  if (res.status === 401 && !retried && getSession() && !url.startsWith('/api/auth/')) {
    if (await refreshSession()) return request(method, url, body, true);
    setSession('');
    emit('wa-session-expired');
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
  businesses: () => request('GET', '/api/businesses'),
  // Saves the answers as a business. After "Edit answers" it replaces that business. Otherwise it is added next to the ones already saved.
  async saveBusiness(answers, label) {
    let target = editingBiz;
    if (!target) {
      const have = (await request('GET', '/api/businesses').catch(() => ({ businesses: [] }))).businesses || [];
      target = have.length ? 'new' : 'main';
    }
    const res = await request('POST', `/api/checklist?biz=${encodeURIComponent(target)}`, { answers, label });
    editingBiz = '';
    setBusiness(res.biz || 'main');
    return res;
  },
  deleteChecklist: () => request('DELETE', '/api/checklist'),
  setDone: (ruleId, done) => request('PATCH', '/api/checklist/done', { ruleId, done }),
  setRenewal: (ruleId, date) => request('PUT', '/api/checklist/renewal', { ruleId, date }),
  dashboard: () => request('GET', '/api/dashboard'),
  notifications: () => request('GET', '/api/notifications'),
  markRead: (id) => request('POST', `/api/notifications/${id}/read`),
  renewalReminder: () => request('POST', '/api/notifications/renewal-reminder'),
  setEmailOptIn: (emailOptIn, email) => request('PUT', '/api/settings', { emailOptIn, email }),
  rules: (lang) => request('GET', lang === 'es' ? '/api/rules?lang=es' : '/api/rules'),
  changes: () => request('GET', '/api/changes'),
  saveDraft: (id, fields) => request('PUT', `/api/rules/${id}/draft`, { fields }),
  discardDraft: (id) => request('DELETE', `/api/rules/${id}/draft`),
  publish: (id, reviewer) => request('POST', `/api/rules/${id}/publish`, { reviewer }),
  questions: (lang) => request('GET', lang === 'es' ? '/api/questions?lang=es' : '/api/questions'),
  setRuleEs: (id, es) => request('PUT', `/api/rules/${id}/es`, { es }),
  addQuestion: (q) => request('POST', '/api/questions', q),
  editQuestion: (id, q) => request('PUT', `/api/questions/${id}`, q),
  removeQuestion: (id) => request('DELETE', `/api/questions/${id}`),
  editStandard: (field, body) => request('PUT', `/api/standard-questions/${field}`, body),
  removeStandard: (field) => request('DELETE', `/api/standard-questions/${field}`),
  restoreStandard: (field) => request('POST', `/api/standard-questions/${field}/restore`),
  ruleFields: (lang) => request('GET', lang === 'es' ? '/api/rule-fields?lang=es' : '/api/rule-fields'),
  addRule: (r) => request('POST', '/api/rules', r),
  setApplies: (id, applies) => request('PUT', `/api/rules/${id}/applies`, { applies }),
  removeRule: (id) => request('DELETE', `/api/rules/${id}`),
  resetDemo: () => request('POST', '/api/demo/reset'),
  sourceReviews: (ruleId) => request('GET', `/api/source-reviews${ruleId ? `?ruleId=${encodeURIComponent(ruleId)}` : ''}`),
  addSourceReview: (review) => request('POST', '/api/source-reviews', review),
  countySources: () => request('GET', '/api/county-sources'),
  saveCountySource: (county, entry) => request('PUT', `/api/county-sources/${encodeURIComponent(county)}`, entry),
  authConfig: () => request('GET', '/api/auth/config'),
  confirmEmail: (email, code) => request('POST', '/api/auth/confirm', { email, code }),
  resendCode: (email) => request('POST', '/api/auth/resend', { email }),
  me: () => request('GET', '/api/auth/me'),
  signup: (name, email, password) => request('POST', '/api/auth/signup', { name, email, password }),
  login: (email, password) => request('POST', '/api/auth/login', { email, password }),
  logout: () => request('POST', '/api/auth/logout'),
  forgot: (email) => request('POST', '/api/auth/forgot', { email }),
  resetPassword: (token, password, email, code) => request('POST', '/api/auth/reset', { token, password, email, code }),
  adminUsers: () => request('GET', '/api/admin/users'),
  adminUser: (id, lang) => request('GET', `/api/admin/users/${encodeURIComponent(id)}${lang === 'es' ? '?lang=es' : ''}`),
  adminSetRole: (id, role) => request('POST', `/api/admin/users/${encodeURIComponent(id)}/role`, { role }),
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
