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
import { intakeTurn, planFromCard, buildTimeline, blankCard, CARD_FIELDS, extractFacts } from './intake.js';

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
  applies: r.applies, draft: r.draft,
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
  const isAdmin = (ctx) => !adminRequired || (Boolean(options.adminKey) && safeEqual(ctx.adminKey, options.adminKey));
  const requireAdmin = (ctx) => {
    if (!isAdmin(ctx)) fail(options.adminKey ? 'Enter the admin key to change rules.' : 'Admin is locked. Set ADMIN_KEY on the server to enable it.', 403);
  };
  const visitorOf = (ctx) => ctx.visitor || DEFAULT_VISITOR;
  const mailer = options.mailer || null;
  const publicUrl = String(options.publicUrl || 'http://localhost:3001').replace(/\/$/, '');
  const emailMode = mailer ? mailer.mode : 'off';
  const FOOTER = 'Demo only, not official guidance. Confirm every date and requirement with the agency.';
  const linkTo = (kind, token) => `${publicUrl}/api/email/${kind}?token=${token}`;

  async function sendReminderEmail(to, token, rule, date, days) {
    const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    await mailer.send({
      to,
      subject: `Reminder: ${rule.title} renewal ${when}`,
      text: [
        `You entered ${date} as the renewal date for "${rule.title}".`,
        `That is ${when}. Check the exact date and how to renew with the agency${rule.agency ? ` (${rule.agency})` : ''}.`,
        rule.apply?.url ? `Official page: ${rule.apply.url}` : rule.source?.url ? `Official page: ${rule.source.url}` : '',
        '',
        FOOTER,
        `Stop these emails: ${linkTo('unsubscribe', token)}`,
      ].filter((l, i, a) => l || a[i - 1]).join('\n'),
    });
  }

  // Sends reminders that are due. Safe to run often: each (rule, date, window) is sent once.
  async function runReminders(now = new Date()) {
    const result = { checked: 0, sent: 0, failed: 0 };
    if (!mailer) return result;
    const startOfDay = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
    const rulesDoc = await loadRules();
    for (const sub of await store.listEmailSubscribers()) {
      const cl = await store.getChecklist(sub.id);
      for (const [ruleId, date] of Object.entries(cl?.renewals || {})) {
        const rule = rulesDoc.rules.find((r) => r.id === ruleId);
        if (!rule || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        result.checked += 1;
        const days = Math.round((Date.parse(`${date}T00:00:00Z`) - startOfDay) / 86400000);
        const crossed = REMINDER_WINDOWS.filter((w) => days <= w);
        if (days < 0 || !crossed.length) continue;
        const key = `${ruleId}|${date}|${Math.min(...crossed)}`;
        if (await store.hasReminderSent(sub.id, key)) continue;
        try {
          await sendReminderEmail(sub.email, sub.token, rule, date, days);
          await store.recordReminder(sub.id, key);
          await store.addNotification(sub.id, {
            id: uuid(), type: 'renewal', simulated: mailer.mode !== 'live', read: false, createdAt: new Date().toISOString(),
            title: `Renewal reminder: ${rule.title}`,
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
  async function resolveCountyHealth(county) {
    const key = countyKeyOf(county);
    if (!key) {
      return { state: 'no-county', message: 'Add your county (use Edit answers) and we will look for its health department page.' };
    }
    const name = countyLabel(county);
    const verified = (await store.listCountySources()).find((c) => c.county === key && c.status === 'verified' && c.officialUrl);
    if (verified) {
      return { state: 'verified', county: name, url: verified.officialUrl, reviewedBy: verified.reviewedBy, reviewedAt: String(verified.reviewedAt || '').slice(0, 10) };
    }
    const found = (options.countyHealthPages?.counties || []).find((c) => countyKeyOf(c.county) === key && c.url);
    if (found) {
      return { state: 'found', county: name, url: found.url, agency: found.agency || '', note: found.note || '', searchedOn: options.countyHealthPages.searchedOn || '' };
    }
    return {
      state: 'not-found', county: name,
      message: `We could not find an official health department page for ${name}. Please contact the ${name} health department directly. The Business Licensing Wizard also lists the agencies to contact for your business.`,
    };
  }

  // Extra pages found by search for a rule. Shown beside the rule's own link and labelled as not yet checked by a person.
  // An entry with a "city" is shown only when the visitor's city matches.
  const foundFor = (ruleId, city) => (options.foundLinks?.links || [])
    .filter((l) => l.ruleId === ruleId && /^https:\/\/[^\s]+$/.test(l.url || '') && (!l.city || String(l.city).toLowerCase() === String(city || '').trim().toLowerCase()))
    .map((l) => ({ label: l.label, url: l.url, agency: l.agency || '', note: l.note || '', searchedOn: options.foundLinks.searchedOn || '' }));

  // Build the response for a saved checklist.
  async function buildChecklist(cl, rulesDoc) {
    const { items, skipped } = evaluate(rulesDoc.rules, cl.answers);
    const countyHealth = items.some((i) => i.rule.id === COUNTY_RULE_ID) ? await resolveCountyHealth(cl.answers.county) : null;
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
        ...(foundFor(i.rule.id, cl.answers.city).length ? { foundLinks: foundFor(i.rule.id, cl.answers.city) } : {}),
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

  route('GET', '/api/health', async () => ({ ok: true, service: 'wa-one-stop-poc-server', storage: store.kind || 'unknown' }));

  route('GET', '/api/admin/status', async ({ ctx }) => ({ ok: true, required: adminRequired, authorized: isAdmin(ctx), keyConfigured: Boolean(options.adminKey) }));

  route('GET', '/api/status', async () => ({ ok: true, storage: store.kind || 'unknown', data: await store.counts() }));

  route('GET', '/api/samples', async () => ({ ok: true, samples: SAMPLES }));

  route('POST', '/api/suggest', async ({ body }) => ({
    ok: true, categories: suggestCategories(body?.text), simulated: true,
  }));

  // Evaluate answers without saving.
  route('POST', '/api/evaluate', async ({ body }) => {
    const rulesDoc = await loadRules();
    const answers = normalizeAnswers(body?.answers);
    const built = await buildChecklist({ answers, label: '', done: {}, renewals: {} }, rulesDoc);
    return { ok: true, ...built, saved: false };
  });

  route('GET', '/api/checklist', async ({ ctx }) => {
    const cl = await store.getChecklist(visitorOf(ctx));
    if (!cl) return { ok: true, saved: false };
    return { ok: true, ...(await buildChecklist(cl, await loadRules())) };
  });

  route('POST', '/api/checklist', async ({ body, ctx }) => {
    const answers = normalizeAnswers(body?.answers);
    if (!answers.structure) fail('Choose a business structure first.');
    const label = typeof body?.label === 'string' ? body.label.slice(0, 80) : '';
    const cl = { answers, label, done: {}, renewals: {}, savedAt: new Date().toISOString() };
    await store.putChecklist(visitorOf(ctx), cl);
    return { ok: true, ...(await buildChecklist(cl, await loadRules())) };
  });

  route('DELETE', '/api/checklist', async ({ ctx }) => {
    await store.deleteChecklist(visitorOf(ctx));
    return { ok: true };
  });

  route('PATCH', '/api/checklist/done', async ({ body, ctx }) => {
    const cl = await store.getChecklist(visitorOf(ctx));
    if (!cl) fail('No saved checklist.', 404);
    const { ruleId, done } = body || {};
    if (typeof ruleId !== 'string' || typeof done !== 'boolean') fail('ruleId and done are required.');
    cl.done[ruleId] = done;
    await store.putChecklist(visitorOf(ctx), cl);
    return { ok: true, ...(await buildChecklist(cl, await loadRules())) };
  });

  route('PUT', '/api/checklist/renewal', async ({ body, ctx }) => {
    const cl = await store.getChecklist(visitorOf(ctx));
    if (!cl) fail('No saved checklist.', 404);
    const { ruleId, date } = body || {};
    if (typeof ruleId !== 'string') fail('ruleId is required.');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('Use a date like 2027-03-31.');
    if (date) cl.renewals[ruleId] = date; else delete cl.renewals[ruleId];
    await store.putChecklist(visitorOf(ctx), cl);
    return { ok: true, ...(await buildChecklist(cl, await loadRules())) };
  });

  route('GET', '/api/dashboard', async ({ ctx }) => {
    const cl = await store.getChecklist(visitorOf(ctx));
    const notes = await store.listNotifications(visitorOf(ctx));
    const unread = notes.filter((n) => !n.read).length;
    if (!cl) return { ok: true, saved: false, unread };
    const rulesDoc = await loadRules();
    const built = await buildChecklist(cl, rulesDoc);
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
      await store.putSettings(v, { emailOptIn: false, email: '', emailConfirmed: false, emailToken: '' });
      return { ok: true, emailOptIn: false, email: '', emailConfirmed: false, emailMode, note: 'Email reminders are off and your address was removed.' };
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
      await mailer.send({
        to: email,
        subject: 'Confirm your renewal reminder emails',
        text: [
          'Someone asked for renewal reminder emails from the WA Business One-Stop-Shop demo using this address.',
          `Confirm: ${linkTo('confirm', token)}`,
          'If this was not you, ignore this message. No reminders are sent until you confirm.',
          `Stop: ${linkTo('unsubscribe', token)}`,
          '', FOOTER,
        ].join('\n'),
      });
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
  route('GET', '/api/rules', async () => {
    const doc = await loadRules();
    return { ok: true, phases: doc.phases, rules: doc.rules.map(publicRule) };
  });

  route('GET', '/api/changes', async () => {
    const doc = await loadRules();
    return { ok: true, changes: [...doc.changes].reverse() };
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
    for (const cl of await store.listChecklists()) {
      if (!evaluate(doc.rules, cl.answers).items.some((i) => i.rule.id === rule.id)) continue;
      await store.addNotification(cl.id, {
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
  route('POST', '/api/chat', async ({ body, ctx }) => {
    const message = String(body?.message ?? '').trim();
    if (!message) fail('Type a question first.');
    if (message.length > 500) fail('Keep the question under 500 characters.');
    const conversation = (Array.isArray(body?.conversation) ? body.conversation : [])
      .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
      .slice(-8)
      .map((t) => ({ role: t.role, content: t.content.slice(0, 1000) }));
    const rulesDoc = await loadRules();
    const cl = await store.getChecklist(visitorOf(ctx));
    const checklist = cl ? await buildChecklist(cl, rulesDoc) : null;
    const result = await answerQuestion({ message, conversation, rules: rulesDoc.rules, checklist, llm: options.llm });
    return { ok: true, ...result };
  });


  /* ---------- The talking guide ----------
     The guide listens and takes notes in a card. Only confirmed card fields reach the rules engine. The server keeps no
     conversation: the browser sends the card each turn, so a visitor can switch between chat and form and lose nothing. */
  // Spoken questions rarely end in a question mark and often start with filler, so look for question words and requests anywhere.
  const QUESTION_RX = /\?\s*$|^\s*(?:(?:so|ok|okay|see|well|hi|hello|hey|um|uh)[\s,]+)*(do|does|did|how|what|when|where|why|can|could|should|is|are|will|which|explain|show|list|give)\b|\b(tell me|show me|explain|what are|what is|what do i|how do i|how to|the steps|which steps|help me understand|want to know|not sure what)\b/i;
  const cardOf = (body) => (body?.card && typeof body.card === 'object' ? body.card : blankCard());

  route('POST', '/api/intake/turn', async ({ body, ctx }) => {
    const message = String(body?.message ?? '').trim();
    if (message.length > 500) fail('Keep each message under 500 characters.');
    const card = cardOf(body);
    const input = { card, message, action: body?.action, field: body?.field, value: body?.value, asking: body?.asking };
    const places = options.places || [];
    // A question with no business details in it goes to the grounded helper, which answers only from the app's own rules and guides.
    if (message && !body?.action && QUESTION_RX.test(message) && !Object.keys(extractFacts(message, places)).length) {
      const rulesDoc = await loadRules();
      const cl = await store.getChecklist(visitorOf(ctx));
      const checklist = cl ? await buildChecklist(cl, rulesDoc) : null;
      const answered = await answerQuestion({ message, conversation: [], rules: rulesDoc.rules, checklist, llm: options.llm });
      const turn = intakeTurn({ ...input, message: '' }, { places });
      return { ok: true, ...turn, reply: answered.answer, answer: { links: answered.links || [], matched: answered.matched || [] }, followUp: turn.ask?.question || '' };
    }
    return { ok: true, ...intakeTurn(input, { places }) };
  });

  route('POST', '/api/intake/plan', async ({ body }) => {
    const rulesDoc = await loadRules();
    const card = cardOf(body);
    const plan = planFromCard(card, rulesDoc.rules);
    const timeline = buildTimeline(plan, rulesDoc.phases, options.processingTimes, new Date(), { simulate: Boolean(body?.simulate) });
    return { ok: true, plan, timeline, complete: plan.complete, answers: plan.answers };
  });

  // Public on purpose: the reviewer must see a rule change without the admin key. It changes no stored rule. It writes one
  // alert, marked as a simulation, to the caller's own notifications and shows the timeline before and after.
  route('POST', '/api/simulate/rule-change', async ({ body, ctx }) => {
    const sim = options.processingTimes?.simulation;
    if (!sim) fail('Simulation is not set up.', 404);
    const rulesDoc = await loadRules();
    const rule = rulesDoc.rules.find((r) => r.id === sim.ruleId);
    const plan = planFromCard(cardOf(body), rulesDoc.rules);
    const affected = plan.items.some((i) => i.id === sim.ruleId);
    const before = options.processingTimes.times.find((t) => t.ruleId === sim.ruleId);
    const timelineBefore = buildTimeline(plan, rulesDoc.phases, options.processingTimes, new Date());
    const timelineAfter = buildTimeline(plan, rulesDoc.phases, options.processingTimes, new Date(), { simulate: true });
    const title = `Simulation: ${rule?.title || sim.ruleId} changed`;
    const notice = affected
      ? `The source page for "${rule?.title}" now shows ${sim.text} for the ${sim.label.toLowerCase()}, up from ${before?.text}. This step is on your plan, so your earliest date moved.`
      : `The source page for "${rule?.title}" changed. This step is not on your plan, so nothing moved for you.`;
    let alert = null;
    if (affected) {
      alert = {
        id: uuid(), type: 'rule-changed', simulated: true, read: false, createdAt: new Date().toISOString(), title,
        body: `${notice} This is a made-up change to show how alerts work. No real page changed.`,
      };
      await store.addNotification(visitorOf(ctx), alert);
    }
    return {
      ok: true, simulated: true, affected,
      rule: { id: sim.ruleId, title: rule?.title || sim.ruleId, source: rule?.source || null },
      before: { label: before?.label || sim.label, text: before?.text || 'not recorded' },
      after: { label: sim.label, text: sim.text, note: sim.note || '' },
      notice: { draft: true, text: notice, note: 'The guide drafts the notice. A person approves it before any owner sees it.' },
      alert, timelineBefore, timelineAfter,
    };
  });

  // Returns { status, body }. Never throws.
  async function handle(method, rawPath, body, ctx = {}) {
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
