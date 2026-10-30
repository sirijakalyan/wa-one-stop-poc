import { ruleTextMap, toSpanish, linkToSpanish, esChatToEn } from './chatEs.js';
import { renderEmail, renderMessagePage, longDate } from './emailTemplate.js';
import { normalizeEmail, AuthError } from './auth.js';
import { createLocalIdp } from './localIdp.js';
// Transport-neutral API. Express (server/src/app.js) and the in-browser preview
// (client/src/artifact/mockServer.js) both call this same code, so the preview
// runs the real rules engine and the real API logic.
//
//   const service = createService(store);
//   const { status, body } = await service.handle('POST', '/api/checklist', { ... });
//
// A store is the async interface in docStore.js / db/pgStore.js. Visitor data is keyed by ctx.visitor.

import { DISCLAIMER } from './disclaimer.js';
import { evaluate, normalizeAnswers, suggestCategories, countyLabel } from './engine.js';
import { SAMPLES } from './samples.js';
import { answerQuestion } from './chat.js';
import { cleanLang, ES, ES_RX, esToEn } from './i18n.js';
import { localizeRules, localizeFound, localizeCountyNote, localizeTimes } from './localize.js';
import { intakeTurn, spokenConfirmation, planFromCard, buildTimeline, blankCard, CARD_FIELDS, extractFacts } from './intake.js';

const DEFAULT_VISITOR = 'public-demo';
const EMAIL_RX = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const REMINDER_WINDOWS = [30, 14, 7, 1]; // days before a renewal date
const randomToken = () => {
  const b = new Uint8Array(24);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
};
const today = () => new Date().toISOString().slice(0, 10);
const uuid = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Rule fields an admin may change. Everything else is fixed.
const EDITABLE = ['title', 'detail', 'source.label', 'source.url', 'apply.label', 'apply.url', 'verification.status', 'verification.note'];
const URL_FIELDS = ['source.url', 'apply.url'];

const getPath = (obj, p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
function setPath(obj, p, value) {
  const keys = p.split('.');
  let o = obj;
  keys.slice(0, -1).forEach((k) => {
    if (o[k] == null) o[k] = {};
    o = o[k];
  });
  o[keys[keys.length - 1]] = value;
}

function validateDraft(fields) {
  const clean = {};
  for (const [key, raw] of Object.entries(fields || {})) {
    if (!EDITABLE.includes(key)) return { error: `Field "${key}" cannot be edited.` };
    const value = String(raw ?? '').trim();
    if (key === 'title' && (!value || value.length > 200)) return { error: 'Title is required and must be 200 characters or fewer.' };
    if (key !== 'title' && value.length > 1000) return { error: `${key} is too long.` };
    if (URL_FIELDS.includes(key) && value && !/^https:\/\/[^\s]+$/.test(value)) return { error: `${key} must be a full https:// link.` };
    if (key === 'verification.status' && !['checked', 'pending'].includes(value)) return { error: 'Verification status must be "checked" or "pending".' };
    clean[key] = value;
  }
  return { clean };
}

// Public view of a rule for the admin screen and the sources screen.
const publicRule = (r) => ({
  id: r.id, order: r.order, phase: r.phase, title: r.title, agency: r.agency, detail: r.detail,
  source: r.source, apply: r.apply, verification: r.verification, owner: r.owner,
  reviewer: r.reviewer, lastVerified: r.lastVerified, version: r.version, status: r.status,
  applies: r.applies, draft: r.draft, custom: Boolean(r.custom), es: r.es || null,
  supports: r.supports || '', limits: r.limits || '', fallback: r.fallback || '', guide: r.guide || null,
});

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status = 400) => {
  throw new HttpError(status, message);
};

// Constant-time string compare (no Node imports so this file also runs in the browser preview).
function safeEqual(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

// options.adminKey: when set, admin routes need the matching X-Admin-Key header.
// options.adminLocked: no key configured but admin must stay closed (production without ADMIN_KEY).
// options.mailer: optional { mode, send({ to, subject, text }) }. Without it (browser preview) email stays simulated.
// options.publicUrl: base URL of this API, used in confirm and unsubscribe links.
// options.countyHealthPages: { counties: [{ county, agency, url|null, note }] } candidate pages found by search. Never treated as verified.
// options.foundLinks: { searchedOn, links: [{ ruleId, label, url, agency, note }] } extra pages found by search. Never treated as verified.
// options.places: [[city, county]] pairs, used only to spot a city in what the owner says.
// options.processingTimes: the agency times recorded in doc 11 (server/seed/processing_times.json). Nothing else is ever shown as a time.
// options.llm: optional async ({ system, user }) => text, used only to rephrase grounded chat answers.
export function createService(store, options = {}) {
  const loadRules = () => store.readRules();
  const adminRequired = Boolean(options.adminKey) || Boolean(options.adminLocked);
  const keyOk = (ctx) => Boolean(options.adminKey) && safeEqual(ctx.adminKey, options.adminKey);
  const accountAdmin = (ctx) => ctx.account?.role === 'admin';
  const isAdmin = (ctx) => !adminRequired || keyOk(ctx) || accountAdmin(ctx);
  // User data is personal: it needs a real admin (the key or an admin account), never the open local-development mode.
  const requireStrictAdmin = (ctx) => {
    if (!keyOk(ctx) && !accountAdmin(ctx)) fail(ctx.account ? 'This account is not an admin.' : 'Sign in with an admin account to see users.', 403);
  };
  const requireAdmin = (ctx) => {
    if (!isAdmin(ctx)) fail(options.adminKey ? 'Enter the admin key to change rules.' : 'Admin is locked. Set ADMIN_KEY on the server to enable it.', 403);
  };
  const visitorOf = (ctx) => ctx.visitor || DEFAULT_VISITOR;
  // One account can keep several businesses. The first one lives under the visitor id itself ("main"), the others under
  // "<visitor>~<id>". Routes pick one with ?biz=<id>; with no biz they use the main one, exactly as before.
  const baseOf = (key) => String(key).split('~')[0];
  const bizIdOf = (key) => (String(key).includes('~') ? String(key).split('~')[1] : 'main');
  const bizId = () => Math.random().toString(36).slice(2, 8).padEnd(6, 'x');
  function chKey(ctx, query, body) {
    const biz = String(query?.biz || body?.biz || '');
    if (!biz || biz === 'main') return visitorOf(ctx);
    if (!/^[a-z0-9]{4,12}$/.test(biz)) fail('Unknown business.', 404);
    return `${visitorOf(ctx)}~${biz}`;
  }
  async function businessesOf(visitor) {
    const mine = (await store.listChecklists()).filter((c) => baseOf(c.id) === visitor);
    mine.sort((a, b) => (b.id === visitor) - (a.id === visitor) || String(a.savedAt || '').localeCompare(String(b.savedAt || '')));
    return mine;
  }
  // The page language travels as ?lang=es (or lang in the body). It only changes the words shown, never what applies.
  const langIn = (query, body) => cleanLang(query?.lang || body?.lang);
  const mailer = options.mailer || null;
  const publicUrl = String(options.publicUrl || 'http://localhost:3001').replace(/\/$/, '');
  const emailMode = mailer ? mailer.mode : 'off';
  const FOOTER = 'Please confirm every date and requirement with the agency before you act.';
  const linkTo = (kind, token) => `${publicUrl}/api/email/${kind}?token=${token}`;

  async function sendReminderEmail(to, token, rule, date, days, business = '') {
    const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    const agency = rule.agency || '';
    const page = rule.apply?.url || rule.source?.url || '';
    const { text, html } = renderEmail({
      heading: days === 0 ? 'Your renewal is due today' : 'Your renewal is coming up',
      paragraphs: [
        { text: `You need to renew "${rule.title}" ${when}.`, bold: [`"${rule.title}"`, when] },
        `Please check the exact deadline and the renewal steps with the agency${agency ? ` (${agency})` : ''} so nothing lapses.`,
      ],
      facts: [
        ...(business ? [{ label: 'Business', value: business }] : []),
        { label: 'What to renew', value: rule.title },
        { label: 'Renewal date', value: longDate(date) },
        { label: 'Time left', value: days === 0 ? 'Due today' : days === 1 ? '1 day' : `${days} days` },
        ...(agency ? [{ label: 'Agency', value: agency }] : []),
      ],
      button: page ? { label: 'Open the official page', url: page } : undefined,
      note: `This date is the one you entered in ${'WA Business One-Stop-Shop'}. ${FOOTER}`,
      footer: 'You get this because renewal reminders are on for your account.',
      footerLinks: [{ label: 'Stop these emails', url: linkTo('unsubscribe', token) }],
    });
    await mailer.send({ to, subject: `Action needed: renew "${rule.title}"${business ? ` for ${business}` : ''} ${when}`, text, html });
  }

  // Sends reminders that are due. Safe to run often: each (rule, date, window) is sent once.
  async function runReminders(now = new Date(), onlyVisitor = '') {
    const result = { checked: 0, sent: 0, failed: 0 };
    if (!mailer) return result;
    const startOfDay = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
    const rulesDoc = await loadRules();
    for (const sub of await store.listEmailSubscribers()) {
      if (onlyVisitor && sub.id !== onlyVisitor) continue;
      const all = (await store.listChecklists()).filter((c) => baseOf(c.id) === sub.id);
      const dates = [];
      // With more than one business, each email and notice says which business it is about.
      for (const cl of all) for (const [ruleId, date] of Object.entries(cl.renewals || {})) dates.push([ruleId, date, bizIdOf(cl.id), all.length > 1 ? (cl.label || 'Your business') : '']);
      for (const [ruleId, date, biz, bizName] of dates) {
        const rule = rulesDoc.rules.find((r) => r.id === ruleId);
        if (!rule || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        result.checked += 1;
        const days = Math.round((Date.parse(`${date}T00:00:00Z`) - startOfDay) / 86400000);
        const crossed = REMINDER_WINDOWS.filter((w) => days <= w);
        if (days < 0 || !crossed.length) continue;
        const key = `${biz === 'main' ? '' : `${biz}|`}${ruleId}|${date}|${Math.min(...crossed)}`;
        if (await store.hasReminderSent(sub.id, key)) continue;
        try {
          await sendReminderEmail(sub.email, sub.token, rule, date, days, bizName);
          await store.recordReminder(sub.id, key);
          await store.addNotification(sub.id, {
            id: uuid(), type: 'renewal', simulated: mailer.mode !== 'live', read: false, createdAt: new Date().toISOString(),
            title: `Renewal reminder: ${rule.title}${bizName ? ` (${bizName})` : ''}`,
            body: `Renewal date ${date}. ${mailer.mode === 'live' ? 'We emailed you this reminder.' : 'Demo mode: the email was written to the server log, not delivered.'} Check the date with the agency.`,
          });
          result.sent += 1;
        } catch (err) {
          console.error('[email] reminder failed:', err.message);
          result.failed += 1;
        }
      }
    }
    return result;
  }

  // County health page for the food permit step. A page a person verified in Admin wins. Otherwise a page found by search is
  // shown as "not yet verified". Otherwise the visitor gets a plain message that nothing was found. Nothing here is ever invented.
  const COUNTY_RULE_ID = 'health';
  const countyKeyOf = (c) => String(c ?? '').trim().toLowerCase().replace(/\s+county$/, '').replace(/\s+/g, ' ');
  async function resolveCountyHealth(county, lang = 'en') {
    const es = lang === 'es';
    const key = countyKeyOf(county);
    if (!key) {
      return { state: 'no-county', message: es ? 'Agregue su condado (use Editar respuestas) y buscaremos la página de su departamento de salud.' : 'Add your county (use Edit answers) and we will look for its health department page.' };
    }
    const name = es ? `Condado de ${String(county).trim().replace(/\s+county$/i, '').trim()}` : countyLabel(county);
    const verified = (await store.listCountySources()).find((c) => c.county === key && c.status === 'verified' && c.officialUrl);
    if (verified) {
      return { state: 'verified', county: name, url: verified.officialUrl, reviewedBy: verified.reviewedBy, reviewedAt: String(verified.reviewedAt || '').slice(0, 10) };
    }
    const found = (options.countyHealthPages?.counties || []).find((c) => countyKeyOf(c.county) === key && c.url);
    if (found) {
      return { state: 'found', county: name, url: found.url, agency: found.agency || '', note: localizeCountyNote(found.note || '', lang), searchedOn: options.countyHealthPages.searchedOn || '' };
    }
    return {
      state: 'not-found', county: name,
      message: es
        ? `No pudimos encontrar una página oficial del departamento de salud de ${name}. Comuníquese directamente con el departamento de salud de ese condado. El Asistente de licencias comerciales también enumera las agencias con las que comunicarse para su negocio.`
        : `We could not find an official health department page for ${name}. Please contact the ${name} health department directly. The Business Licensing Wizard also lists the agencies to contact for your business.`,
    };
  }

  // Extra pages found by search for a rule. Shown beside the rule's own link and labelled as not yet checked by a person.
  // An entry with a "city" is shown only when the visitor's city matches.
  const foundFor = (ruleId, city) => (options.foundLinks?.links || [])
    .filter((l) => l.ruleId === ruleId && /^https:\/\/[^\s]+$/.test(l.url || '') && (!l.city || String(l.city).toLowerCase() === String(city || '').trim().toLowerCase()))
    .map((l) => ({ label: l.label, url: l.url, agency: l.agency || '', note: l.note || '', searchedOn: options.foundLinks.searchedOn || '' }));

  // Build the response for a saved checklist.
  async function buildChecklist(cl, rawDoc, lang = 'en') {
    const rulesDoc = localizeRules(rawDoc, lang);
    const { items, skipped } = evaluate(rulesDoc.rules, cl.answers, lang);
    const countyHealth = items.some((i) => i.rule.id === COUNTY_RULE_ID) ? await resolveCountyHealth(cl.answers.county, lang) : null;
    const ids = new Set(items.map((i) => i.rule.id));
    const titleById = Object.fromEntries(rulesDoc.rules.map((r) => [r.id, r.title]));
    return {
      saved: true,
      label: cl.label,
      answers: cl.answers,
      phases: rulesDoc.phases,
      items: items.map((i) => ({
        id: i.rule.id, title: i.rule.title, agency: i.rule.agency, phase: i.rule.phase,
        status: i.status, reason: i.reason, detail: i.rule.detail,
        after: i.rule.after && ids.has(i.rule.after) ? titleById[i.rule.after] : null,
        source: i.rule.source, apply: i.rule.apply, verification: i.rule.verification,
        lastVerified: i.rule.lastVerified, version: i.rule.version,
        fallback: i.rule.fallback || '', noLink: i.noLink || '',
        supports: i.rule.supports || '', limits: i.rule.limits || '', guide: i.rule.guide || null, owner: i.rule.owner, reviewer: i.rule.reviewer || null,
        done: Boolean(cl.done[i.rule.id]), renewal: cl.renewals[i.rule.id] || null,
        ...(i.rule.id === COUNTY_RULE_ID ? { countyHealth } : {}),
        ...(foundFor(i.rule.id, cl.answers.city).length ? { foundLinks: foundFor(i.rule.id, cl.answers.city).map((l) => localizeFound(l, lang)) } : {}),
      })),
      skipped,
    };
  }

  const routes = [];
  const route = (method, pattern, handler) => {
    const names = [];
    const rx = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; })}$`);
    routes.push({ method, rx, names, handler });
  };

  // Activity log. Only for signed-in accounts. Details are short plain text (a step name or a date), never answers or passwords.
  async function track(ctx, type, detail = '') {
    if (!ctx.account) return;
    try { await store.addEvent(visitorOf(ctx), { at: new Date().toISOString(), type, detail: String(detail).slice(0, 200) }); } catch { /* the log must never break the action */ }
  }
  async function ruleTitle(id) {
    try { return (await loadRules()).rules.find((r) => r.id === id)?.title || String(id).slice(0, 80); } catch { return String(id).slice(0, 80); }
  }

  /* ---------- Accounts ----------
     Who people are is handled by an identity provider (options.idp): the app's own store for the demo, or AWS Cognito.
     A signed-in account has its own saved plan (visitor id "acct-<id>"). Signed-out visitors can still use the guide. */
  const adminEmails = (options.adminEmails || []).map(normalizeEmail);
  const idp = options.idp || createLocalIdp({ store, adminEmails, mailer, publicUrl, demoResetLinks: options.demoResetLinks, footer: FOOTER });
  const acctVisitor = (a) => `acct-${a.id}`;
  const viaIdp = async (fn) => {
    try { return await fn(); } catch (e) { if (e instanceof AuthError) fail(e.message, e.status); throw e; }
  };
  const publicUser = (a) => ({ id: a.id, name: a.name, email: a.email, role: a.role });
  const nowIso = () => new Date().toISOString();
  // Renewal reminders go to the email the person signed in with, from their first sign in. They can stop them any time.
  async function startAccountReminders(user) {
    if (!mailer || !user.email) return;
    const v = acctVisitor(user);
    const cur = await store.getSettings(v);
    if (cur.emailToken) return; // already set up (on or stopped)
    await store.putSettings(v, { emailOptIn: true, email: user.email, emailConfirmed: true, emailToken: randomToken() });
  }
  async function adoptPlan(ctx, user, onlyIfEmpty) {
    if (!ctx.anonVisitor || ctx.anonVisitor === acctVisitor(user)) return;
    if (onlyIfEmpty && (await store.getChecklist(acctVisitor(user)))) return;
    const cl = await store.getChecklist(ctx.anonVisitor);
    if (cl) await store.putChecklist(acctVisitor(user), cl); // the plan made before signing in becomes the account's plan
  }

  route('GET', '/api/auth/config', async () => ({ ok: true, provider: idp.mode, needsCode: Boolean(idp.needsCode), requireLogin: Boolean(options.requireLogin) }));

  route('POST', '/api/auth/signup', async ({ body, ctx }) => {
    const r = await viaIdp(() => idp.signup({ name: body?.name, email: body?.email, password: body?.password }));
    if (r.needsConfirm) return { ok: true, needsConfirm: true, email: normalizeEmail(body?.email) };
    await adoptPlan(ctx, r.user, false);
    await store.addEvent(acctVisitor(r.user), { at: nowIso(), type: 'signup', detail: 'Account created' });
    return { ok: true, token: r.token, refreshToken: r.refreshToken || '', user: r.user };
  });

  route('POST', '/api/auth/confirm', async ({ body }) => {
    await viaIdp(() => idp.confirm({ email: normalizeEmail(body?.email), code: String(body?.code || '').trim() }));
    return { ok: true, message: 'Your email is confirmed. You can sign in now.' };
  });

  route('POST', '/api/auth/resend', async ({ body }) => {
    await viaIdp(() => idp.resend({ email: normalizeEmail(body?.email) }));
    return { ok: true, message: 'If this account is waiting for confirmation, a new code is on its way.' };
  });

  route('POST', '/api/auth/login', async ({ body, ctx }) => {
    const r = await viaIdp(() => idp.login({ email: body?.email, password: body?.password }));
    if (r.needsConfirm) return { ok: true, needsConfirm: true, email: normalizeEmail(body?.email) };
    await adoptPlan(ctx, r.user, true);
    const firstLogin = !(await store.listEvents(acctVisitor(r.user), 200)).some((e) => e.type === 'login');
    if (firstLogin) await startAccountReminders(r.user);
    await store.addEvent(acctVisitor(r.user), { at: nowIso(), type: 'login', detail: 'Signed in' });
    return { ok: true, token: r.token, refreshToken: r.refreshToken || '', user: r.user };
  });

  route('POST', '/api/auth/refresh', async ({ body }) => {
    const r = await viaIdp(() => idp.refresh({ refreshToken: String(body?.refreshToken || ''), email: body?.email }));
    return { ok: true, token: r.token, user: r.user };
  });

  route('POST', '/api/auth/logout', async ({ ctx }) => {
    if (ctx.account) await idp.logout({ account: ctx.account, sessionHash: ctx.sessionHash, token: ctx.session });
    return { ok: true };
  });

  route('GET', '/api/auth/me', async ({ ctx }) => ({ ok: true, user: ctx.account ? publicUser(ctx.account) : null }));

  route('POST', '/api/auth/forgot', async ({ body }) => ({ ok: true, ...(await viaIdp(() => idp.forgot({ email: body?.email }))) }));

  route('POST', '/api/auth/reset', async ({ body }) => {
    const r = await viaIdp(() => idp.reset({ token: body?.token, email: normalizeEmail(body?.email), code: String(body?.code || '').trim(), password: body?.password }));
    if (r.id) await store.addEvent(`acct-${r.id}`, { at: nowIso(), type: 'password-reset', detail: 'Password changed' });
    return { ok: true, message: r.message };
  });

  /* ---------- Admin: users ---------- */
  // Every business the account has saved, with progress. The first one also fills the older single-business fields.
  async function progressOf(a, rulesDoc) {
    const all = await businessesOf(acctVisitor(a));
    if (!all.length) return { saved: false, label: '', done: 0, total: 0, percent: 0, businesses: [] };
    const businesses = [];
    for (const cl of all) {
      const built = await buildChecklist(cl, rulesDoc, 'en');
      const done = built.items.filter((i) => i.done).length;
      businesses.push({ id: bizIdOf(cl.id), label: cl.label || '', done, total: built.items.length });
    }
    const done = businesses.reduce((n, x) => n + x.done, 0);
    const total = businesses.reduce((n, x) => n + x.total, 0);
    return { saved: true, label: businesses[0].label, done, total, percent: total ? Math.round((done / total) * 100) : 0, businesses };
  }
  route('GET', '/api/admin/users', async ({ ctx }) => {
    requireStrictAdmin(ctx);
    const rulesDoc = await loadRules();
    const accounts = await viaIdp(() => idp.listUsers());
    const users = [];
    for (const a of accounts.slice(0, 500)) {
      const ev = await store.listEvents(acctVisitor(a), 1);
      users.push({ ...publicUser(a), createdAt: a.createdAt, lastLoginAt: a.lastLoginAt || '', lastActivity: ev[0]?.at || '', ...(await progressOf(a, rulesDoc)) });
    }
    return { ok: true, users, total: accounts.length };
  });
  route('GET', '/api/admin/users/:id', async ({ params, ctx, query }) => {
    requireStrictAdmin(ctx);
    const a = await viaIdp(() => idp.getUser(params.id));
    if (!a) fail('User not found.', 404);
    const rulesDoc = await loadRules();
    const checklists = [];
    for (const cl of await businessesOf(acctVisitor(a))) {
      const built = await buildChecklist(cl, rulesDoc, langIn(query));
      const english = langIn(query) === 'es' ? Object.fromEntries((await buildChecklist(cl, rulesDoc, 'en')).items.map((i) => [i.id, i.title])) : {};
      checklists.push({ id: bizIdOf(cl.id), label: cl.label || '', answers: cl.answers, savedAt: cl.savedAt || '', items: built.items.map((i) => ({ id: i.id, title: i.title, titleEn: english[i.id] || i.title, status: i.status, done: i.done, renewal: i.renewal || '', agency: i.agency || '' })) });
    }
    return {
      ok: true,
      user: { ...publicUser(a), createdAt: a.createdAt, lastLoginAt: a.lastLoginAt || '' },
      checklist: checklists[0] || null, // the first business, for older callers
      checklists,
      events: await store.listEvents(acctVisitor(a), 200),
    };
  });
  route('POST', '/api/admin/users/:id/role', async ({ params, body, ctx }) => {
    requireStrictAdmin(ctx);
    const role = body?.role;
    if (!['user', 'admin'].includes(role)) fail('Role must be user or admin.');
    if (ctx.account?.id === params.id && role !== 'admin') fail('You cannot remove your own admin role.');
    const u = await viaIdp(() => idp.setRole(params.id, role));
    if (!u) fail('User not found.', 404);
    await store.addEvent(acctVisitor(u), { at: nowIso(), type: 'role-changed', detail: `Role set to ${role}${ctx.account ? ` by ${ctx.account.email}` : ' with the admin key'}` });
    return { ok: true, user: publicUser(u) };
  });

  route('GET', '/api/health', async () => ({ ok: true, service: 'wa-one-stop-poc-server', storage: store.kind || 'unknown' }));

  route('GET', '/api/admin/status', async ({ ctx }) => ({ ok: true, required: adminRequired, authorized: isAdmin(ctx), keyConfigured: Boolean(options.adminKey), accountAdmin: accountAdmin(ctx), strict: keyOk(ctx) || accountAdmin(ctx) }));

  route('GET', '/api/status', async () => ({ ok: true, storage: store.kind || 'unknown', data: await store.counts() }));

  route('GET', '/api/samples', async () => ({ ok: true, samples: SAMPLES }));

  route('POST', '/api/suggest', async ({ body }) => ({
    ok: true, categories: suggestCategories(body?.text), simulated: true,
  }));

  // Evaluate answers without saving.
  route('POST', '/api/evaluate', async ({ body, query }) => {
    const rulesDoc = await loadRules();
    const answers = cleanExtra(normalizeAnswers(body?.answers), questionsOf(rulesDoc));
    const built = await buildChecklist({ answers, label: '', done: {}, renewals: {} }, rulesDoc, langIn(query, body));
    return { ok: true, ...built, saved: false };
  });

  route('GET', '/api/checklist', async ({ ctx, query }) => {
    const key = chKey(ctx, query);
    const cl = await store.getChecklist(key);
    if (!cl) return { ok: true, saved: false };
    return { ok: true, biz: bizIdOf(key), ...(await buildChecklist(cl, await loadRules(), langIn(query))) };
  });

  // Every business this person has saved, with progress, so My business can show them all.
  route('GET', '/api/businesses', async ({ ctx, query }) => {
    const rulesDoc = await loadRules();
    const out = [];
    for (const cl of await businessesOf(visitorOf(ctx))) {
      const built = await buildChecklist(cl, rulesDoc, langIn(query));
      const done = built.items.filter((i) => i.done).length;
      out.push({ id: bizIdOf(cl.id), label: cl.label || '', savedAt: cl.savedAt || '', total: built.items.length, done, percent: built.items.length ? Math.round((done / built.items.length) * 100) : 0 });
    }
    return { ok: true, businesses: out };
  });

  route('POST', '/api/checklist', async ({ body, ctx, query }) => {
    const answers = cleanExtra(normalizeAnswers(body?.answers), questionsOf(await loadRules()));
    if (!answers.structure) fail('Choose a business structure first.');
    const label = typeof body?.label === 'string' ? body.label.slice(0, 80) : '';
    const asNew = String(query?.biz || body?.biz || '') === 'new';
    let key = asNew ? `${visitorOf(ctx)}~${bizId()}` : chKey(ctx, query, body);
    if (asNew && (await businessesOf(visitorOf(ctx))).length >= 20) fail('You can keep up to 20 businesses. Remove one to add another.');
    // Saving over a business that already exists keeps its done marks and renewal dates for the answers that did not change.
    const before = asNew ? null : await store.getChecklist(key);
    const cl = { answers, label, done: before?.done || {}, renewals: before?.renewals || {}, savedAt: new Date().toISOString() };
    await store.putChecklist(key, cl);
    await track(ctx, asNew ? 'business-added' : 'plan-saved', label || 'Checklist saved');
    return { ok: true, biz: bizIdOf(key), ...(await buildChecklist(cl, await loadRules(), langIn(query, body))) };
  });

  route('DELETE', '/api/checklist', async ({ ctx, query }) => {
    await store.deleteChecklist(chKey(ctx, query));
    await track(ctx, 'plan-deleted', 'Started over');
    return { ok: true };
  });

  route('PATCH', '/api/checklist/done', async ({ body, ctx, query }) => {
    const key = chKey(ctx, query, body);
    const cl = await store.getChecklist(key);
    if (!cl) fail('No saved checklist.', 404);
    const { ruleId, done } = body || {};
    if (typeof ruleId !== 'string' || typeof done !== 'boolean') fail('ruleId and done are required.');
    cl.done[ruleId] = done;
    await store.putChecklist(key, cl);
    await track(ctx, done ? 'step-done' : 'step-undone', await ruleTitle(ruleId));
    return { ok: true, ...(await buildChecklist(cl, await loadRules(), langIn(query, body))) };
  });

  route('PUT', '/api/checklist/renewal', async ({ body, ctx, query }) => {
    const key = chKey(ctx, query, body);
    const cl = await store.getChecklist(key);
    if (!cl) fail('No saved checklist.', 404);
    const { ruleId, date } = body || {};
    if (typeof ruleId !== 'string') fail('ruleId is required.');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('Use a date like 2027-03-31.');
    if (date) cl.renewals[ruleId] = date; else delete cl.renewals[ruleId];
    await store.putChecklist(key, cl);
    await track(ctx, date ? 'renewal-set' : 'renewal-cleared', `${await ruleTitle(ruleId)}${date ? `: ${date}` : ''}`);
    // A signed-in person gets any reminder that is already due right away (the hourly check would send it later).
    if (date && ctx.account) { try { await runReminders(new Date(), visitorOf(ctx)); } catch (e) { console.error('[email] reminder failed:', e.message); } }
    return { ok: true, ...(await buildChecklist(cl, await loadRules(), langIn(query, body))) };
  });

  route('GET', '/api/dashboard', async ({ ctx, query }) => {
    const cl = await store.getChecklist(chKey(ctx, query));
    const notes = await store.listNotifications(visitorOf(ctx));
    const unread = notes.filter((n) => !n.read).length;
    if (!cl) return { ok: true, saved: false, unread };
    const lang = langIn(query);
    const rulesDoc = localizeRules(await loadRules(), lang);
    const built = await buildChecklist(cl, await loadRules(), lang);
    const done = built.items.filter((i) => i.done).length;
    const next = built.items.find((i) => !i.done) || null;
    const byPhase = Object.entries(rulesDoc.phases).map(([p, name]) => {
      const inPhase = built.items.filter((i) => String(i.phase) === p);
      return { phase: Number(p), name, total: inPhase.length, done: inPhase.filter((i) => i.done).length };
    }).filter((p) => p.total > 0);
    return {
      ok: true, saved: true, label: built.label, total: built.items.length, done,
      percent: built.items.length ? Math.round((done / built.items.length) * 100) : 0,
      next, byPhase, items: built.items, unread,
    };
  });

  route('GET', '/api/notifications', async ({ ctx }) => {
    const notes = await store.listNotifications(visitorOf(ctx));
    const settings = await store.getSettings(visitorOf(ctx));
    return {
      ok: true, notifications: [...notes].reverse(), emailOptIn: settings.emailOptIn,
      email: settings.email, emailConfirmed: settings.emailConfirmed, emailMode,
      accountEmail: ctx.account?.email || '', // signed in: reminders go to this address
    };
  });

  route('POST', '/api/notifications/renewal-reminder', async ({ ctx }) => {
    const cl = await store.getChecklist(visitorOf(ctx));
    const entries = cl ? Object.entries(cl.renewals) : [];
    if (!entries.length) fail('Add a renewal date to a checklist item on the Progress screen first.');
    const rulesDoc = await loadRules();
    const settings = await store.getSettings(visitorOf(ctx));
    const emailing = Boolean(mailer && settings.emailOptIn && settings.emailConfirmed && settings.email);
    let emailed = 0;
    for (const [ruleId, date] of entries) {
      const rule = rulesDoc.rules.find((r) => r.id === ruleId);
      if (!rule) continue;
      let sentNow = false;
      if (emailing) {
        const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86400000);
        try {
          await sendReminderEmail(settings.email, settings.emailToken, rule, date, Math.max(days, 0));
          sentNow = true;
          emailed += 1;
        } catch (err) {
          console.error('[email] reminder failed:', err.message);
        }
      }
      await store.addNotification(visitorOf(ctx), {
        id: uuid(), type: 'renewal', simulated: !(sentNow && mailer.mode === 'live'), read: false, createdAt: new Date().toISOString(),
        title: `Renewal reminder${sentNow && mailer.mode === 'live' ? '' : ' (simulated)'}: ${rule.title}`,
        body: sentNow && mailer.mode === 'live'
          ? `Renewal date ${date}. We emailed you this reminder. Check the renewal date with the agency.`
          : `You entered ${date} as the renewal date. ${sentNow ? 'Demo mode: the email was written to the server log.' : 'Turn on email reminders to get this by email.'} Check the renewal date with the agency.`,
      });
    }
    return { ok: true, created: entries.length, emailed };
  });

  route('POST', '/api/notifications/:id/read', async ({ params, ctx }) => {
    if (!(await store.markRead(visitorOf(ctx), params.id))) fail('Notification not found.', 404);
    return { ok: true };
  });

  route('PUT', '/api/settings', async ({ body, ctx }) => {
    const v = visitorOf(ctx);
    const cur = await store.getSettings(v);
    const optIn = Boolean(body?.emailOptIn);
    if (!mailer) {
      await store.putSettings(v, { emailOptIn: optIn });
      return { ok: true, emailOptIn: optIn, emailMode, note: 'Simulated. No email is ever sent.' };
    }
    if (!optIn) {
      // Opting out removes the stored address.
      if (ctx.account) { // keep the token so the first-sign-in setup does not turn it back on
        await store.putSettings(v, { emailOptIn: false, emailConfirmed: false, emailToken: cur.emailToken || randomToken() });
        return { ok: true, emailOptIn: false, emailMode, note: 'Renewal reminder emails are off.' };
      }
      await store.putSettings(v, { emailOptIn: false, email: '', emailConfirmed: false, emailToken: '' });
      return { ok: true, emailOptIn: false, email: '', emailConfirmed: false, emailMode, note: 'Email reminders are off and your address was removed.' };
    }
    if (ctx.account?.email) { // a signed-in person: their account email, no separate confirmation
      await store.putSettings(v, { emailOptIn: true, email: ctx.account.email, emailConfirmed: true, emailToken: cur.emailToken || randomToken() });
      return { ok: true, emailOptIn: true, email: ctx.account.email, emailConfirmed: true, emailMode, note: 'Renewal reminders will be emailed to your account address.' };
    }
    const email = String(body?.email ?? cur.email ?? '').trim().toLowerCase();
    if (!EMAIL_RX.test(email) || email.length > 254) fail('Enter a valid email address, for example name@example.com.');
    if (cur.emailConfirmed && cur.email === email) {
      await store.putSettings(v, { emailOptIn: true });
      return { ok: true, emailOptIn: true, email, emailConfirmed: true, emailMode, note: 'Email reminders are on.' };
    }
    const token = randomToken();
    await store.putSettings(v, { emailOptIn: true, email, emailConfirmed: false, emailToken: token });
    try {
      const conf = renderEmail({
        heading: 'Confirm your renewal reminder emails',
        paragraphs: ['Someone asked for renewal reminder emails from WA Business One-Stop-Shop using this address.', 'Reminders start only after you confirm.'],
        button: { label: 'Confirm my email', url: linkTo('confirm', token) },
        note: 'If this was not you, ignore this message and nothing will be sent.',
        footer: FOOTER,
        footerLinks: [{ label: 'Stop', url: linkTo('unsubscribe', token) }],
      });
      await mailer.send({ to: email, subject: 'Confirm your renewal reminder emails', text: conf.text, html: conf.html });
    } catch (err) {
      console.error('[email] confirmation failed:', err.message);
      await store.putSettings(v, { emailOptIn: false, email: '', emailConfirmed: false, emailToken: '' });
      fail('We could not send the confirmation email just now. Please try again later.', 502);
    }
    return {
      ok: true, emailOptIn: true, email, emailConfirmed: false, emailMode,
      note: mailer.mode === 'live' ? 'Check your inbox and click the confirm link.' : 'Demo mode: the confirmation link was written to the server log.',
    };
  });

  // Links inside emails. Anyone holding the token can confirm or stop their own reminders.
  route('GET', '/api/email/confirm', async ({ query }) => {
    const v = await store.findVisitorByToken(String(query?.token || ''));
    if (!v) fail('This confirmation link is not valid any more.', 404);
    await store.putSettings(v, { emailOptIn: true, emailConfirmed: true });
    return { ok: true, message: 'Thank you. Renewal reminder emails are now on. You can stop them any time from the link in each email.' };
  });

  route('GET', '/api/email/unsubscribe', async ({ query }) => {
    const v = await store.findVisitorByToken(String(query?.token || ''));
    if (!v) return { ok: true, message: 'You are already unsubscribed.' };
    await store.putSettings(v, { emailOptIn: false, email: '', emailConfirmed: false, emailToken: '' });
    return { ok: true, message: 'You are unsubscribed. We removed your email address and will not send more reminders.' };
  });

  // Sends the caller's due reminders now (they are also sent automatically once an hour).
  route('POST', '/api/reminders/send-due', async ({ ctx }) => {
    requireAdmin(ctx);
    return { ok: true, ...(await runReminders()) };
  });

  /* ---------- Admin rules management (locked by ADMIN_KEY when configured) ---------- */
  route('GET', '/api/rules', async ({ query }) => {
    const doc = localizeRules(await loadRules(), langIn(query));
    return { ok: true, phases: doc.phases, rules: doc.rules.map(publicRule) };
  });

  route('GET', '/api/changes', async () => {
    const doc = await loadRules();
    return { ok: true, changes: [...doc.changes].reverse() };
  });

  /* ---------- Questions and rules an admin adds ----------
     Questions live in the rules document (doc.questions). Their answers ride along in answers.extra and a rule can test
     them with a condition on the field "extra.<question id>". Built-in questions can be used the same way. */
  const BUILTIN_QUESTIONS = {
    structure: { text: 'How the business is set up', type: 'choice', options: [['sole', 'Sole proprietor'], ['llc', 'LLC'], ['corp', 'Corporation'], ['partnership', 'Partnership or LLP'], ['unsure', 'Not sure yet']] },
    cats: { text: 'Kind of business', type: 'multi', options: [['food', 'Food service'], ['construction', 'Construction contracting'], ['other', 'Other service or retail']] },
    hiring: { text: 'Hiring within 90 days', type: 'yesno' },
    subs: { text: 'Uses subcontractors', type: 'yesno' },
    salestax: { text: 'Collects sales tax', type: 'yesno' },
    income: { text: 'Gross income $12,000 or more', type: 'yesno' },
    tradename: { text: 'Uses a business name', type: 'yesno' },
  };
  const YESNO_OPTIONS = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Not sure' }];
  const NOT_SURE = { value: 'unsure', label: 'Not sure' };
  const questionsOf = (doc) => (Array.isArray(doc.questions) ? doc.questions : []);
  const qRand = () => Math.random().toString(36).slice(2, 8).padEnd(6, 'x');

  // Keep only answers to questions that exist, with a value that is one of that question's options.
  function cleanExtra(answers, questions) {
    if (!answers.extra) return answers;
    const extra = {};
    for (const q of questions) {
      const v = answers.extra[q.id];
      if (v && q.options.some((o) => o.value === v)) extra[q.id] = v;
    }
    const out = { ...answers };
    if (Object.keys(extra).length) out.extra = extra; else delete out.extra;
    return out;
  }

  // The questions as the questionnaire shows them: yes/no ones get the three standard answers, choice ones get "Not sure" last.
  const NOT_SURE_ES = { yes: 'Sí', no: 'No', unsure: 'No estoy seguro' };
  // Shown in the page language when an admin wrote a Spanish version; otherwise the text stays as the admin typed it.
  function localizeQuestion(q, lang) {
    if (lang !== 'es') return q;
    const es = q.es || {};
    const std = q.type === 'yesno' ? (o) => NOT_SURE_ES[o.value] : (o) => (o.value === 'unsure' ? NOT_SURE_ES.unsure : undefined);
    const picks = q.options.filter((o) => o.value !== 'unsure');
    return {
      ...q,
      text: es.text || q.text,
      hint: es.hint || q.hint,
      options: q.options.map((o) => ({ ...o, label: std(o) || (Array.isArray(es.options) && es.options.length === picks.length ? es.options[picks.findIndex((x) => x.value === o.value)] : '') || o.label })),
    };
  }
  const publicQuestion = (q, lang = 'en') => { const l = localizeQuestion(q, lang); return { id: l.id, text: l.text, hint: l.hint || '', type: l.type, options: l.options, es: q.es || null }; };

  // Optional Spanish version of a question: the question, the help text and one line per choice.
  function cleanEs(body, type, count) {
    const es = body?.es;
    if (!es || typeof es !== 'object') return null;
    const text = String(es.text ?? '').trim();
    const hint = String(es.hint ?? '').trim();
    if (text.length > 200) fail('The Spanish question must be 200 characters or fewer.');
    if (hint.length > 300) fail('The Spanish help text must be 300 characters or fewer.');
    let options;
    if (type === 'choice') {
      const lines = (Array.isArray(es.options) ? es.options : []).map((o) => String(o ?? '').trim()).filter(Boolean);
      if (lines.length && lines.length !== count) fail(`Write ${count} Spanish choices, one for each English choice, or leave them all empty.`);
      if (lines.some((l) => l.length > 80)) fail('Each Spanish choice must be 80 characters or fewer.');
      if (lines.length) options = lines;
    }
    if (!text && !hint && !options) return null;
    return { text, hint, ...(options ? { options } : {}) };
  }

  function cleanQuestion(body, existing) {
    const text = String(body?.text ?? '').trim();
    if (!text || text.length > 200) fail('Write the question in 200 characters or fewer.');
    const hint = String(body?.hint ?? '').trim();
    if (hint.length > 300) fail('The help text must be 300 characters or fewer.');
    const type = existing ? existing.type : body?.type;
    if (!['yesno', 'choice'].includes(type)) fail('Choose Yes / No / Not sure, or a list of choices.');
    let options = YESNO_OPTIONS;
    if (type === 'choice') {
      const given = (Array.isArray(body?.options) ? body.options : []).map((o) => (typeof o === 'string' ? { label: o } : o || {}));
      const list = given.map((o) => ({ value: String(o.value || ''), label: String(o.label ?? '').trim() })).filter((o) => o.label && o.value !== 'unsure');
      if (list.length < 2 || list.length > 8) fail('Give between 2 and 8 choices. "Not sure" is added for you.');
      if (list.some((o) => o.label.length > 80)) fail('Each choice must be 80 characters or fewer.');
      if (new Set(list.map((o) => o.label.toLowerCase())).size !== list.length) fail('Each choice needs its own wording.');
      const used = new Set((existing?.options || []).map((o) => o.value));
      let n = 1;
      options = list.map((o) => {
        if (o.value && /^o[0-9]{1,3}$/.test(o.value) && used.has(o.value)) return o;
        while (used.has(`o${n}`) || list.some((x) => x.value === `o${n}`)) n += 1;
        const value = `o${n}`;
        used.add(value);
        return { value, label: o.label };
      });
      options = [...options, NOT_SURE];
    }
    const es = cleanEs(body, type, options.filter((o) => o.value !== 'unsure').length);
    return { text, hint, type, options, ...(es ? { es } : { es: undefined }) };
  }

  route('GET', '/api/questions', async ({ query }) => ({ ok: true, questions: questionsOf(await loadRules()).map((q) => publicQuestion(q, langIn(query))) }));

  route('POST', '/api/questions', async ({ body, ctx }) => {
    requireAdmin(ctx);
    const doc = await loadRules();
    const list = questionsOf(doc);
    if (list.length >= 12) fail('You can add up to 12 questions. Remove one first.');
    const q = { id: `q_${qRand()}`, ...cleanQuestion(body, null), createdAt: new Date().toISOString() };
    doc.questions = [...list, q];
    await store.writeRules(doc);
    return { ok: true, question: publicQuestion(q), questions: doc.questions.map(publicQuestion) };
  });

  route('PUT', '/api/questions/:id', async ({ params, body, ctx }) => {
    requireAdmin(ctx);
    const doc = await loadRules();
    const list = questionsOf(doc);
    const i = list.findIndex((q) => q.id === params.id);
    if (i < 0) fail('Question not found.', 404);
    const next = { ...list[i], ...cleanQuestion(body, list[i]) };
    doc.questions = list.map((q, k) => (k === i ? next : q));
    await store.writeRules(doc);
    return { ok: true, question: publicQuestion(next), questions: doc.questions.map(publicQuestion) };
  });

  route('DELETE', '/api/questions/:id', async ({ params, ctx }) => {
    requireAdmin(ctx);
    const doc = await loadRules();
    const list = questionsOf(doc);
    const q = list.find((x) => x.id === params.id);
    if (!q) fail('Question not found.', 404);
    const uses = doc.rules.filter((r) => JSON.stringify(r.applies || {}).includes(`"extra.${q.id}"`));
    if (uses.length) fail(`This question decides who sees "${uses[0].title}". Remove or change that rule first.`);
    doc.questions = list.filter((x) => x.id !== q.id);
    await store.writeRules(doc);
    return { ok: true, questions: doc.questions.map(publicQuestion) };
  });

  // The questions a rule can depend on: the built-in ones and the ones an admin added.
  route('GET', '/api/rule-fields', async ({ ctx }) => {
    requireAdmin(ctx);
    const fields = Object.entries(BUILTIN_QUESTIONS).map(([field, q]) => ({
      field, text: q.text, options: q.type === 'yesno' ? YESNO_OPTIONS.map((o) => ({ value: o.value, label: o.label })) : q.options.map(([value, label]) => ({ value, label })),
    }));
    for (const q of questionsOf(await loadRules())) fields.push({ field: `extra.${q.id}`, text: q.text, options: q.options });
    return { ok: true, fields };
  });

  // "Applies to everyone" or "applies when <question> is <answer>". "Not sure" makes it show as "may apply".
  function conditionFrom(spec, questions) {
    if (!spec || spec.mode === 'always' || spec.always) return { always: true };
    const field = String(spec.field || '');
    const value = String(spec.value || '');
    let text;
    let label;
    if (field.startsWith('extra.')) {
      const q = questions.find((x) => x.id === field.slice(6));
      if (!q) fail('That question no longer exists.');
      const o = q.options.find((x) => x.value === value);
      if (!o || value === 'unsure') fail('Choose one of that question\'s answers.');
      text = q.text; label = o.label;
    } else {
      const b = BUILTIN_QUESTIONS[field];
      if (!b) fail('Choose a question.');
      const o = b.type === 'yesno' ? YESNO_OPTIONS.find((x) => x.value === value) : b.options.map(([v, l]) => ({ value: v, label: l })).find((x) => x.value === value);
      if (!o || value === 'unsure') fail('Choose one of that question\'s answers.');
      text = b.text; label = o.label;
    }
    const leaf = field === 'cats' ? { field, includes: value } : { field, is: value };
    return { ...leaf, label: `you answered "${label}" to "${text}"`, ask: text.toLowerCase() };
  }
  const describeCondition = (c) => (c?.always ? 'everyone' : c?.field ? `${c.field}:${c.is ?? c.includes}` : 'custom');

  function recordChange(doc, rule, field, from, to, ctx) {
    doc.changes.push({ id: uuid(), ruleId: rule.id, ruleTitle: rule.title, version: rule.version, fields: [{ field, from, to }], reviewer: ctx.account?.email || 'admin key', at: new Date().toISOString() });
  }

  async function notifyAffected(rule, rulesDoc, fields) {
    let queued = 0;
    const told = new Set();
    for (const cl of await store.listChecklists()) {
      if (!evaluate(rulesDoc.rules, cl.answers).items.some((i) => i.rule.id === rule.id)) continue;
      if (told.has(baseOf(cl.id))) continue;
      told.add(baseOf(cl.id));
      await store.addNotification(baseOf(cl.id), {
        id: uuid(), type: 'rule-changed', simulated: true, read: false, createdAt: new Date().toISOString(),
        title: `Rule changed: ${rule.title}`,
        body: `An update was made (${fields.join(', ')}). Review this step in your checklist.`,
      });
      queued += 1;
    }
    return queued;
  }

  // Optional Spanish version of a rule an admin adds: what people read in Spanish. Empty fields fall back to the English text.
  function cleanRuleEs(es) {
    if (!es || typeof es !== 'object') return null;
    const f = (v, max, what) => { const x = String(v ?? '').trim(); if (x.length > max) fail(`The Spanish ${what} must be ${max} characters or fewer.`); return x; };
    const out = { title: f(es.title, 200, 'name'), agency: f(es.agency, 120, 'agency'), detail: f(es.detail, 1000, 'detail'), sourceLabel: f(es.sourceLabel, 200, 'source name'), applyLabel: f(es.applyLabel, 120, 'button text') };
    return Object.values(out).some(Boolean) ? out : null;
  }

  route('PUT', '/api/rules/:id/es', async ({ params, body, ctx }) => {
    requireAdmin(ctx);
    const doc = await loadRules();
    const rule = doc.rules.find((r) => r.id === params.id);
    if (!rule) fail('Rule not found.', 404);
    if (!rule.custom) fail('Only a rule an admin added has its Spanish text edited here. The built-in rules already have Spanish.');
    const es = cleanRuleEs(body?.es);
    if (es) rule.es = es; else delete rule.es;
    await store.writeRules(doc);
    return { ok: true, rule: publicRule(rule) };
  });

  route('POST', '/api/rules', async ({ body, ctx }) => {
    requireAdmin(ctx);
    const doc = await loadRules();
    const title = String(body?.title ?? '').trim();
    if (!title || title.length > 200) fail('Give the requirement a name of 200 characters or fewer.');
    const agency = String(body?.agency ?? '').trim();
    if (!agency || agency.length > 120) fail('Name the agency (120 characters or fewer).');
    const phase = Number(body?.phase);
    if (!Object.keys(doc.phases).includes(String(phase))) fail('Choose where this step belongs on the road to opening day.');
    const detail = String(body?.detail ?? '').trim();
    if (detail.length > 1000) fail('The plain-language detail must be 1000 characters or fewer.');
    const url = (v, what) => {
      const x = String(v ?? '').trim();
      if (x && !/^https:\/\/[^\s]{1,500}$/.test(x)) fail(`${what} must be a full https:// link.`);
      return x;
    };
    const sourceUrl = url(body?.sourceUrl, 'The source link');
    if (!sourceUrl) fail('Add the official source link. Every requirement shows where it comes from.');
    const applyUrl = url(body?.applyUrl, 'The apply link');
    const sourceLabel = String(body?.sourceLabel ?? '').trim().slice(0, 200) || agency;
    const applyLabel = String(body?.applyLabel ?? '').trim().slice(0, 120) || 'Open the official page';
    const applies = conditionFrom(body?.applies, questionsOf(doc));
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'rule';
    const order = Math.max(0, ...doc.rules.filter((r) => r.phase === phase).map((r) => r.order || 0)) + 10;
    const rule = {
      id: `custom-${slug}-${qRand()}`, order, phase, title, agency, applies, custom: true,
      reason: {
        applies: applies.always ? 'This step applies to every business.' : 'This step applies because {hits}.',
        maybe: 'You were not sure about: {unsure}. This step may apply to you.',
        no: 'Left out because of your answers.',
      },
      detail, after: null,
      source: { label: sourceLabel, url: sourceUrl },
      apply: applyUrl ? { label: applyLabel, url: applyUrl } : null,
      verification: { status: 'pending', note: 'Added by an admin. A second person has not checked it against the official page yet.' },
      owner: '[NEEDS HUMAN INPUT: content owner]', reviewer: null, lastVerified: null, version: 1, status: 'published', draft: null,
      fallback: '', noLink: applyUrl ? '' : 'This step has no apply button. Use the source link under Source details.', supports: '', limits: '', guide: null,
      ...(cleanRuleEs(body?.es) ? { es: cleanRuleEs(body.es) } : {}),
    };
    doc.rules = [...doc.rules, rule];
    recordChange(doc, rule, 'rule', '', `added, applies to ${describeCondition(applies)}`, ctx);
    await store.writeRules(doc);
    const queued = await notifyAffected(rule, doc, ['new step']);
    return { ok: true, rule: publicRule(rule), queuedNotifications: queued };
  });

  route('PUT', '/api/rules/:id/applies', async ({ params, body, ctx }) => {
    requireAdmin(ctx);
    const doc = await loadRules();
    const rule = doc.rules.find((r) => r.id === params.id);
    if (!rule) fail('Rule not found.', 404);
    if (!rule.custom) fail('Only a rule an admin added can be changed here. The built-in rules are fixed in the rules file.');
    const from = describeCondition(rule.applies);
    rule.applies = conditionFrom(body?.applies, questionsOf(doc));
    rule.reason = { ...rule.reason, applies: rule.applies.always ? 'This step applies to every business.' : 'This step applies because {hits}.' };
    rule.version += 1;
    recordChange(doc, rule, 'applies', from, describeCondition(rule.applies), ctx);
    await store.writeRules(doc);
    const queued = await notifyAffected(rule, doc, ['who it applies to']);
    return { ok: true, rule: publicRule(rule), queuedNotifications: queued };
  });

  route('DELETE', '/api/rules/:id', async ({ params, ctx }) => {
    requireAdmin(ctx);
    const doc = await loadRules();
    const rule = doc.rules.find((r) => r.id === params.id);
    if (!rule) fail('Rule not found.', 404);
    if (!rule.custom) fail('Only a rule an admin added can be removed. The built-in rules are fixed in the rules file.');
    doc.rules = doc.rules.filter((r) => r.id !== rule.id);
    recordChange(doc, rule, 'rule', 'added', 'removed', ctx);
    await store.writeRules(doc);
    return { ok: true };
  });

  route('PUT', '/api/rules/:id/draft', async ({ params, body, ctx }) => {
    requireAdmin(ctx);
    const doc = await loadRules();
    const rule = doc.rules.find((r) => r.id === params.id);
    if (!rule) fail('Rule not found.', 404);
    const { clean, error } = validateDraft(body?.fields);
    if (error) fail(error);
    // Keep only values that differ from the published rule.
    const changed = {};
    for (const [k, v] of Object.entries(clean)) {
      if ((getPath(rule, k) ?? '') !== v) changed[k] = v;
    }
    rule.draft = Object.keys(changed).length ? changed : null;
    await store.writeRules(doc);
    return { ok: true, rule: publicRule(rule) };
  });

  route('DELETE', '/api/rules/:id/draft', async ({ params, ctx }) => {
    requireAdmin(ctx);
    const doc = await loadRules();
    const rule = doc.rules.find((r) => r.id === params.id);
    if (!rule) fail('Rule not found.', 404);
    rule.draft = null;
    await store.writeRules(doc);
    return { ok: true, rule: publicRule(rule) };
  });

  // Approve and publish a draft. A named reviewer is required.
  // Then queue a simulated notice if the rule affects the saved checklist.
  route('POST', '/api/rules/:id/publish', async ({ params, body, ctx }) => {
    requireAdmin(ctx);
    const reviewer = String(body?.reviewer || '').trim().slice(0, 80);
    if (!reviewer) fail('Enter the reviewer name to approve this change.');
    const doc = await loadRules();
    const rule = doc.rules.find((r) => r.id === params.id);
    if (!rule) fail('Rule not found.', 404);
    if (!rule.draft) fail('There is no draft to publish.');
    const fields = [];
    for (const [k, v] of Object.entries(rule.draft)) {
      const from = getPath(rule, k) ?? '';
      if (k.startsWith('apply.') && rule.apply == null) rule.apply = { label: 'Official page', url: '' };
      setPath(rule, k, v);
      fields.push({ field: k, from, to: v });
    }
    rule.draft = null;
    rule.version += 1;
    rule.reviewer = reviewer;
    rule.lastVerified = today();
    doc.changes.push({ id: uuid(), ruleId: rule.id, ruleTitle: rule.title, version: rule.version, fields, reviewer, at: new Date().toISOString() });
    await store.writeRules(doc);

    // Queue one simulated notice for every visitor whose saved checklist includes this rule.
    let queued = 0;
    const told = new Set();
    for (const cl of await store.listChecklists()) {
      if (!evaluate(doc.rules, cl.answers).items.some((i) => i.rule.id === rule.id)) continue;
      if (told.has(baseOf(cl.id))) continue;
      told.add(baseOf(cl.id));
      await store.addNotification(baseOf(cl.id), {
        id: uuid(), type: 'rule-changed', simulated: true, read: false, createdAt: new Date().toISOString(),
        title: `Rule changed: ${rule.title}`,
        body: `An agency content owner approved an update (${fields.map((f) => f.field).join(', ')}). Review this step in your checklist.`,
      });
      queued += 1;
    }
    return { ok: true, rule: publicRule(rule), queuedNotifications: queued };
  });

  // Restores the original rules and clears the caller's own checklist, notifications and settings.
  route('POST', '/api/demo/reset', async ({ ctx }) => {
    requireAdmin(ctx);
    await store.resetRules();
    await store.resetVisitor(visitorOf(ctx));
    return { ok: true };
  });

  /* ---------- Evidence: source reviews and verified county pages ----------
     Recording evidence never changes a rule's status or approval. Reads are public. Writes need the admin key. */
  const countyKey = (c) => String(c ?? '').trim().toLowerCase().replace(/\s+county$/, '').replace(/\s+/g, ' ');

  route('GET', '/api/source-reviews', async ({ query }) => ({
    ok: true, reviews: await store.listSourceReviews({ ruleId: query?.ruleId || undefined, limit: 100 }),
  }));

  route('POST', '/api/source-reviews', async ({ body, ctx }) => {
    requireAdmin(ctx);
    const rulesDoc = await loadRules();
    const ruleId = String(body?.ruleId ?? '');
    if (!rulesDoc.rules.some((r) => r.id === ruleId)) fail('Choose a rule from the list.');
    const sourceUrl = String(body?.sourceUrl ?? '').trim();
    if (!/^https:\/\/[^\s]{1,500}$/.test(sourceUrl)) fail('The source must be a full https:// link.');
    const reviewedBy = String(body?.reviewedBy ?? '').trim();
    if (!reviewedBy || reviewedBy.length > 80) fail('Enter the reviewer name (80 characters or fewer).');
    if (!['checked', 'pending'].includes(body?.result)) fail('Result must be "checked" or "pending".');
    const notes = String(body?.notes ?? '').trim();
    if (notes.length > 1000) fail('Notes must be 1000 characters or fewer.');
    const review = { id: uuid(), ruleId, sourceUrl, reviewedBy, reviewedAt: new Date().toISOString(), result: body.result, notes };
    await store.addSourceReview(review);
    return { ok: true, review };
  });

  route('GET', '/api/county-sources', async () => ({ ok: true, counties: await store.listCountySources() }));

  route('PUT', '/api/county-sources/:county', async ({ params, body, ctx }) => {
    requireAdmin(ctx);
    const county = countyKey(params.county);
    if (!/^[a-z][a-z .'-]{1,40}$/.test(county)) fail('Enter a county name, for example King.');
    const officialUrl = String(body?.officialUrl ?? '').trim();
    if (!/^https:\/\/[^\s]{1,500}$/.test(officialUrl)) fail('The official page must be a full https:// link.');
    const reviewedBy = String(body?.reviewedBy ?? '').trim();
    if (!reviewedBy || reviewedBy.length > 80) fail('Enter the reviewer name (80 characters or fewer).');
    if (!['verified', 'pending'].includes(body?.status)) fail('Status must be "verified" or "pending".');
    const entry = { county, officialUrl, reviewedBy, reviewedAt: new Date().toISOString(), status: body.status };
    await store.upsertCountySource(entry);
    return { ok: true, county: entry };
  });

  /* ---------- Chat: answers only from the rule records ---------- */
  route('POST', '/api/chat', async ({ body, ctx, query }) => {
    const message = String(body?.message ?? '').trim();
    if (!message) fail('Type a question first.');
    if (message.length > 500) fail('Keep the question under 500 characters.');
    const conversation = (Array.isArray(body?.conversation) ? body.conversation : [])
      .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
      .slice(-8)
      .map((t) => ({ role: t.role, content: t.content.slice(0, 1000) }));
    const rulesDoc = await loadRules();
    const cl = await store.getChecklist(chKey(ctx, query, body));
    const checklist = cl ? await buildChecklist(cl, rulesDoc) : null;
    const es = cleanLang(body?.lang) === 'es';
    // Spanish: the question is matched to the English records, then the answer is turned into Spanish (rule text from the Spanish records,
    // the sentences around it from a table). The friendly rewrite is skipped so the answer stays exactly what the records say.
    const result = await answerQuestion({ message: es ? esChatToEn(message, esToEn) : message, conversation: es ? [] : conversation, rules: rulesDoc.rules, checklist, llm: es ? null : options.llm });
    if (es) {
      if (result.mode === 'fallback') return { ok: true, ...result, answer: ES.noMatch, links: [], suggestions: [] };
      const map = ruleTextMap(rulesDoc.rules, localizeRules(rulesDoc, 'es').rules);
      const titles = new Map((result.matched || []).map((m) => [m.id, map.get(m.title) || m.title]));
      return {
        ok: true,
        ...result,
        answer: toSpanish(result.answer, map),
        links: (result.links || []).map((l) => linkToSpanish(l, map)),
        matched: (result.matched || []).map((m) => ({ ...m, title: titles.get(m.id) })),
        suggestions: [],
      };
    }
    return { ok: true, ...result };
  });


  /* ---------- The talking guide ----------
     The guide listens and takes notes in a card. Only confirmed card fields reach the rules engine. The server keeps no
     conversation: the browser sends the card each turn, so a visitor can switch between chat and form and lose nothing. */
  // Spoken questions rarely end in a question mark and often start with filler, so look for question words and requests anywhere.
  // A real question, even if it mentions a detail ("Do I need a permit for a food truck?"), is answered and never taken as a statement about the business.
  const NOT = String.raw`(?!\s+(?:not|n't)\b)`;
  const STRICT_Q_RX = new RegExp(String.raw`\?\s*$|^\s*(?:(?:so|ok|okay|see|well|hi|hello|hey|um|uh|and)[\s,]+)*(do|does|did|how|what|whats|when|where|why|can|could|should|is|are|which)\b${NOT}`, 'i');
  // A question that starts with a statement ("I dont have employees, do I still need workers comp").
  const MID_Q_RX = /\b(do i|do we|can i|can u|can you|am i|is it|is that|is this|are you|should i|will i|would i|what do i|what should i|what will i|how much|how long|how many|how do i)\b(?!\s+not\b)/i;
  const QUESTION_RX = new RegExp(STRICT_Q_RX.source + String.raw`|^\s*(?:(?:so|ok|okay|see|well)[\s,]+)*(will|explain|show|list|give)\b|\b(tell me|show me|explain|what are|what is|the steps|which steps|help me understand|want to know|not sure what|how to)\b`, 'i');
  const SPECIAL_ES = /(?<![\p{L}])(alcohol|licor|cerveza|vino|bebidas alcoh[oó]licas|cannabis|marihuana|tabaco|armas|guarder[ií]a|cuidado de ni[ñn]os|peluquer[ií]a|barber[ií]a|taxi|bienes ra[ií]ces|farmacia|cl[ií]nica)(?![\p{L}])/iu;
  const AI_Q = /\b(are you|r u|you)\s+(a\s+|an\s+)?(real|human|person|robot|bot|ai|machine|chatgpt)\b/i;
  const OFFICIAL_Q = /\b(is|are) (this|it|you|the app|the site)\b[^.?!]{0,20}\b(official|government|legit|legal advice)\b|\bofficial (site|website|app|advice)\b/i;
  const SPECIAL = /\b(alcohol|liquor|beer|wine|spirits|cannabis|marijuana|tobacco|vape|firearms?|guns?|daycare|day care|child ?care|cosmetolog\w*|barber\w*|hair salon|nail salon|taxi|trucking|real estate|insurance agent|pharmacy|clinic|medical)\b/i;
  const cardOf = (body) => (body?.card && typeof body.card === 'object' ? body.card : blankCard());

  route('POST', '/api/intake/turn', async ({ body, ctx, query }) => {
    const message = String(body?.message ?? '').trim();
    if (message.length > 500) fail('Keep each message under 500 characters.');
    const card = cardOf(body);
    const lang = cleanLang(body?.lang);
    const es = lang === 'es';
    // "Yes that is right" said aloud counts as tapping the button, so it must be checked before anything else.
    const spoken = !body?.action ? spokenConfirmation(card, message, body?.asking) : null;
    const input = { card, message: spoken ? '' : message, action: spoken || body?.action, field: body?.field, value: body?.value, asking: body?.asking, lang };
    const places = options.places || [];
    const said = message && !body?.action && !spoken;
    const hasFacts = said && Object.keys(extractFacts(message, places)).length > 0;
    const strictQ = es ? ES_RX.strictQuestion : STRICT_Q_RX;
    const midQ = es ? ES_RX.midQuestion : MID_Q_RX;
    const looseQ = es ? new RegExp(`${ES_RX.strictQuestion.source}|\\b(dime|expl[ií]came|cu[eé]ntame|mu[eé]strame|quiero saber|los pasos)\\b`, 'iu') : QUESTION_RX;
    const question = said && ((looseQ.test(message) && !hasFacts) || strictQ.test(message) || midQ.test(message));
    // Spanish questions are matched to the English rules and guides through a word list (a retrieval aid only). The agency text
    // stays in English, and the answer says so, so nobody mistakes it for a reviewed translation.
    const askGrounded = async (text, { keepOnFallback = false } = {}) => {
      const rulesDoc = await loadRules();
      const cl = await store.getChecklist(chKey(ctx, query, body));
      const checklist = cl ? await buildChecklist(cl, rulesDoc) : null;
      const q = (es ? esToEn(text) : text).replace(/\bstill\b/gi, ' ').replace(/\s+/g, ' ').trim();
      const answered = await answerQuestion({ message: q, conversation: [], rules: rulesDoc.rules, checklist, llm: options.llm });
      if (keepOnFallback && answered.mode === 'fallback') return null;
      const turn = intakeTurn({ ...input, message: '' }, { places });
      const replyText = es ? (answered.mode === 'fallback' ? ES.noMatch : `${ES.englishNote}\n${answered.answer}`) : answered.answer;
      return { ok: true, ...turn, reply: replyText, answer: { links: answered.links || [], matched: answered.matched || [] }, followUp: turn.ask?.question || (turn.awaiting === 'confirm' ? turn.reply : '') };
    };
    const reply = async (text) => {
      const turn = intakeTurn({ ...input, message: '' }, { places });
      return { ok: true, ...turn, reply: text, answer: { links: [], matched: [] }, followUp: turn.ask?.question || (turn.awaiting === 'confirm' ? turn.reply : '') };
    };
    // Fixed answers, in the language the owner chose.
    const fixed = (m) => {
      if (es) {
        if (ES_RX.ai.test(m)) return ES.ai;
        if (ES_RX.official.test(m)) return ES.official;
        if (ES_RX.outOfScope.test(m)) return ES.outOfScope;
        if (ES_RX.otherState.test(m)) return ES.otherState;
        if (ES_RX.costTotal.test(m)) return ES.costTotal;
        if (ES_RX.timeTotal.test(m)) return ES.timeTotal;
        return '';
      }
      if (AI_Q.test(m)) return 'I am an AI guide, not a person. I take notes and explain steps from the written rules in this app. The rules decide what applies to you, and you confirm every fact.';
      if (OFFICIAL_Q.test(m)) return 'No. This is a demo, not an official government site, and it is not legal advice. Each step links to the agency\'s own page, so confirm there before you apply.';
      return '';
    };
    // A question goes to the grounded helper, which answers only from the app's own rules and guides, and never changes the card.
    if (question) {
      const f = fixed(message);
      if (f) return reply(f);
      const nothingYet = !Object.values(card.status || {}).includes('confirmed');
      if (nothingYet && (es ? /\b(primer|primero|siguiente)\b/i.test(message) : /\b(first|next)\b/i.test(message) && /\b(what|whats|which)\b/i.test(message))) return askGrounded(es ? 'cómo empiezo' : 'How do I get started?');
      return askGrounded(message);
    }
    if (said && es && !hasFacts) {
      const f = fixed(message);
      if (f) return reply(f);
      if (ES_RX.thanks.test(message)) return reply(ES.thanks);
      if (ES_RX.greeting.test(message)) return reply(ES.greeting);
    }
    const turn = intakeTurn(input, { places });
    // Not a business detail and not an answer to the question: the owner may be talking, not answering, so try the grounded helper.
    if (said && turn.note === 'no-facts' && (es ? ES_RX.confused : /\b(confused|don'?t understand|do not understand|lost|stuck|no idea)\b/i).test(message)) {
      return reply(es ? ES.confused : 'No problem. Tell me, in your own words, what kind of business you want to start, for example "a food truck in Spokane". Or tap one of the answers below. You can also use the step-by-step form instead.');
    }
    // A free-text answer (a city) that was not understood stays a "did not catch that", unless the helper has a real topic for it.
    if (said && turn.note === 'no-facts' && !(es ? /^(s[ií]|no|ok|okay|vale|claro|qu[eé]|eh)\b[\s!.?]*$/i : /^(yes|no|ok|okay|yeah|yep|nope|sure|what|huh)\b[\s!.?]*$/i).test(message)) {
      const g = await askGrounded(message, { keepOnFallback: true });
      if (g && !(body?.asking === 'place' && !looseQ.test(message))) return g;
    }
    // Some businesses need licenses this demo has no rules for. Say so now instead of staying silent.
    if (said && hasFacts && (es ? SPECIAL_ES : SPECIAL).test(message) && turn.reply) {
      turn.reply += es ? ES.special : ' One more thing: some businesses, such as those that sell alcohol or run child care, need special licenses from other agencies. This demo has no rules for those, so ask the agency.';
    }
    return { ok: true, ...turn };
  });

  route('POST', '/api/intake/plan', async ({ body, query }) => {
    const lang = langIn(query, body);
    const rulesDoc = localizeRules(await loadRules(), lang);
    const card = cardOf(body);
    const plan = planFromCard(card, rulesDoc.rules, lang);
    const timeline = buildTimeline(plan, rulesDoc.phases, localizeTimes(options.processingTimes, lang), new Date(), { simulate: Boolean(body?.simulate), lang });
    return { ok: true, plan, timeline, complete: plan.complete, answers: plan.answers };
  });

  // Public on purpose: the reviewer must see a rule change without the admin key. It changes no stored rule. It writes one
  // alert, marked as a simulation, to the caller's own notifications and shows the timeline before and after.
  route('POST', '/api/simulate/rule-change', async ({ body, ctx, query }) => {
    const lang = langIn(query, body);
    const es = lang === 'es';
    const times = localizeTimes(options.processingTimes, lang);
    const sim = times?.simulation;
    if (!sim) fail('Simulation is not set up.', 404);
    const rulesDoc = localizeRules(await loadRules(), lang);
    const rule = rulesDoc.rules.find((r) => r.id === sim.ruleId);
    const plan = planFromCard(cardOf(body), rulesDoc.rules, lang);
    const affected = plan.items.some((i) => i.id === sim.ruleId);
    const before = times.times.find((t) => t.ruleId === sim.ruleId);
    const timelineBefore = buildTimeline(plan, rulesDoc.phases, times, new Date(), { lang });
    const timelineAfter = buildTimeline(plan, rulesDoc.phases, times, new Date(), { simulate: true, lang });
    const title = es ? `Simulación: cambió "${rule?.title || sim.ruleId}"` : `Simulation: ${rule?.title || sim.ruleId} changed`;
    const notice = es
      ? (affected
        ? `La página de la fuente de "${rule?.title}" ahora muestra ${sim.text} para "${sim.label.toLowerCase()}", antes ${before?.text}. Este paso está en su plan, así que su fecha más temprana cambió.`
        : `La página de la fuente de "${rule?.title}" cambió. Este paso no está en su plan, así que nada cambió para usted.`)
      : (affected
        ? `The source page for "${rule?.title}" now shows ${sim.text} for the ${sim.label.toLowerCase()}, up from ${before?.text}. This step is on your plan, so your earliest date moved.`
        : `The source page for "${rule?.title}" changed. This step is not on your plan, so nothing moved for you.`);
    let alert = null;
    if (affected) {
      alert = {
        id: uuid(), type: 'rule-changed', simulated: true, read: false, createdAt: new Date().toISOString(), title,
        body: es ? `${notice} Este es un cambio inventado para mostrar cómo funcionan las alertas. Ninguna página real cambió.` : `${notice} This is a made-up change to show how alerts work. No real page changed.`,
      };
      await store.addNotification(visitorOf(ctx), alert);
    }
    return {
      ok: true, simulated: true, affected,
      rule: { id: sim.ruleId, title: rule?.title || sim.ruleId, source: rule?.source || null },
      before: { label: before?.label || sim.label, text: before?.text || (es ? 'no registrado' : 'not recorded') },
      after: { label: sim.label, text: sim.text, note: sim.note || '' },
      notice: { draft: true, text: notice, note: es ? 'La guía redacta el aviso. Una persona lo aprueba antes de que cualquier dueño lo vea.' : 'The guide drafts the notice. A person approves it before any owner sees it.' },
      alert, timelineBefore, timelineAfter,
    };
  });

  // Returns { status, body }. Never throws.
  async function handle(method, rawPath, body, ctx = {}) {
    // A valid session token turns the request into the account's own: its saved plan, notifications and role.
    ctx = { ...ctx, anonVisitor: ctx.visitor };
    if (ctx.session) {
      let account = null;
      try { account = await idp.resolve(ctx.session); } catch { account = null; }
      if (account) ctx = { ...ctx, account, sessionHash: account.sessionHash, visitor: `acct-${account.id}` };
    }
    const [pathname, qs = ''] = String(rawPath).split('?');
    const query = Object.fromEntries(new URLSearchParams(qs));
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.rx.exec(pathname);
      if (!m) continue;
      const params = Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
      try {
        const out = await r.handler({ params, body, ctx, query });
        return { status: 200, body: { ...out, disclaimer: DISCLAIMER } };
      } catch (err) {
        if (err instanceof HttpError) return { status: err.status, body: { ok: false, error: err.message, disclaimer: DISCLAIMER } };
        console.error(err);
        return { status: 500, body: { ok: false, error: 'Server error', disclaimer: DISCLAIMER } };
      }
    }
    return { status: 404, body: { ok: false, error: 'Not found', disclaimer: DISCLAIMER } };
  }

  return { handle, runReminders };
}
