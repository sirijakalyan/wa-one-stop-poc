// No Node imports here: this file also runs inside the browser preview.
// Store interface used by service.js (async). Three implementations:
//   createDocStore  - on top of read/write of whole JSON documents (file store and in-page preview)
//   createStore     - JSON files on disk (local dev without a database)
//   createPgStore   - PostgreSQL (server/src/db/pgStore.js)
// Visitor data (checklist, notifications, settings) is keyed by an anonymous visitor id.
export function createDocStore({ read, write, seed }) {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  return {
    kind: 'documents',
    async init() {},
    readRules: () => read('rules'),
    writeRules: (doc) => write('rules', doc),
    async resetRules() {
      await write('rules', await seed('rules'));
    },

    async getChecklist(v) {
      const doc = await read('checklists');
      return doc.checklists.find((c) => c.id === v) || null;
    },
    async putChecklist(v, cl) {
      const doc = await read('checklists');
      doc.checklists = doc.checklists.filter((c) => c.id !== v);
      doc.checklists.push({ ...clone(cl), id: v });
      await write('checklists', doc);
    },
    async deleteChecklist(v) {
      const doc = await read('checklists');
      doc.checklists = doc.checklists.filter((c) => c.id !== v);
      await write('checklists', doc);
    },
    async listChecklists() {
      return (await read('checklists')).checklists;
    },

    async listNotifications(v) {
      return (await read('notifications')).notifications.filter((n) => n.visitorId === v || (!n.visitorId && v === 'public-demo'));
    },
    async addNotification(v, n) {
      const doc = await read('notifications');
      doc.notifications.push({ ...clone(n), visitorId: v });
      await write('notifications', doc);
    },
    async markRead(v, id) {
      const doc = await read('notifications');
      const n = doc.notifications.find((x) => x.id === id && (x.visitorId === v || !x.visitorId));
      if (!n) return false;
      n.read = true;
      await write('notifications', doc);
      return true;
    },

    async getSettings(v) {
      const doc = await read('users');
      const u = doc.users.find((x) => x.id === v) || {};
      return {
        emailOptIn: Boolean(u.emailOptIn), email: u.email || '', emailConfirmed: Boolean(u.emailConfirmed), emailToken: u.emailToken || '',
      };
    },
    async putSettings(v, s) {
      const doc = await read('users');
      let u = doc.users.find((x) => x.id === v);
      if (!u) {
        u = { id: v };
        doc.users.push(u);
      }
      u.emailOptIn = Boolean(s.emailOptIn);
      if ('email' in s) u.email = s.email || '';
      if ('emailConfirmed' in s) u.emailConfirmed = Boolean(s.emailConfirmed);
      if ('emailToken' in s) u.emailToken = s.emailToken || '';
      await write('users', doc);
    },
    async findVisitorByToken(token) {
      if (!token) return null;
      const doc = await read('users');
      return doc.users.find((x) => x.emailToken && x.emailToken === token)?.id || null;
    },
    // Visitors who confirmed an address and have not unsubscribed.
    async listEmailSubscribers() {
      const doc = await read('users');
      return doc.users.filter((u) => u.emailOptIn && u.emailConfirmed && u.email).map((u) => ({ id: u.id, email: u.email, token: u.emailToken }));
    },
    async hasReminderSent(v, key) {
      const doc = await read('users');
      return Boolean(doc.users.find((x) => x.id === v)?.sentReminders?.includes(key));
    },
    async recordReminder(v, key) {
      const doc = await read('users');
      const u = doc.users.find((x) => x.id === v);
      if (!u) return;
      u.sentReminders = [...(u.sentReminders || []), key];
      await write('users', doc);
    },

    async resetVisitor(v) {
      const c = await read('checklists');
      c.checklists = c.checklists.filter((x) => x.id !== v);
      await write('checklists', c);
      const n = await read('notifications');
      n.notifications = n.notifications.filter((x) => x.visitorId !== v && !(v === 'public-demo' && !x.visitorId));
      await write('notifications', n);
      const u = await read('users');
      u.users = u.users.filter((x) => x.id !== v);
      await write('users', u);
    },

    async addSourceReview(review) {
      const doc = await read('source_reviews');
      doc.reviews.push(clone(review));
      await write('source_reviews', doc);
    },
    async listSourceReviews({ ruleId, limit = 100 } = {}) {
      const doc = await read('source_reviews');
      return doc.reviews.filter((r) => !ruleId || r.ruleId === ruleId).sort((a, b) => String(b.reviewedAt).localeCompare(String(a.reviewedAt))).slice(0, limit);
    },
    async upsertCountySource(cs) {
      const doc = await read('county_sources');
      doc.counties = doc.counties.filter((c) => c.county !== cs.county);
      doc.counties.push(clone(cs));
      await write('county_sources', doc);
    },
    async listCountySources() {
      return (await read('county_sources')).counties.slice().sort((a, b) => a.county.localeCompare(b.county));
    },

    async counts() {
      const r = await read('rules');
      return {
        rules: r.rules.length,
        checklists: (await read('checklists')).checklists.length,
        notifications: (await read('notifications')).notifications.length,
        sourceReviews: (await read('source_reviews')).reviews.length,
        countySources: (await read('county_sources')).counties.length,
      };
    },

    // Accounts. Sessions, reset tokens and failed-login counters live on the account record (hashed, never plain).
    async createAccount(acct) {
      const doc = await read('accounts');
      if (doc.accounts.some((a) => a.email === acct.email)) return false;
      doc.accounts.push(clone(acct));
      await write('accounts', doc);
      return true;
    },
    async getAccount(id) {
      return (await read('accounts')).accounts.find((a) => a.id === id) || null;
    },
    async findAccountByEmail(email) {
      return (await read('accounts')).accounts.find((a) => a.email === email) || null;
    },
    async findAccountBySession(hash) {
      const now = Date.now();
      return (await read('accounts')).accounts.find((a) => (a.sessions || []).some((x) => x.hash === hash && x.exp > now)) || null;
    },
    async findAccountByResetToken(hash) {
      const now = Date.now();
      return (await read('accounts')).accounts.find((a) => a.resetHash && a.resetHash === hash && a.resetExp > now) || null;
    },
    async updateAccount(id, patch) {
      const doc = await read('accounts');
      const a = doc.accounts.find((x) => x.id === id);
      if (!a) return null;
      Object.assign(a, clone(patch));
      await write('accounts', doc);
      return a;
    },
    async listAccounts() {
      return (await read('accounts')).accounts.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    // Activity log per account (what a person did, with the date). Details are short plain text, never answers or passwords.
    async addEvent(v, e) {
      const doc = await read('events');
      doc.events.push({ ...clone(e), visitorId: v });
      if (doc.events.length > 5000) doc.events = doc.events.slice(-5000);
      await write('events', doc);
    },
    async listEvents(v, limit = 200) {
      return (await read('events')).events.filter((e) => e.visitorId === v).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
    },
    async close() {},
  };
}

