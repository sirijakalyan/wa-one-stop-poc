// In-page "server" for the Claude preview. It runs the SAME service code and
// rules engine as the Express server (server/src/service.js), with an
// in-memory store seeded from server/seed/*.json instead of files on disk.
import { createService } from '../../../server/src/service.js';
import { createDocStore } from '../../../server/src/docStore.js';
import rules from '../../../server/seed/rules.json';
import users from '../../../server/seed/users.json';
import checklists from '../../../server/seed/checklists.json';
import notifications from '../../../server/seed/notifications.json';
import accountsSeed from '../../../server/seed/accounts.json';
import eventsSeed from '../../../server/seed/events.json';
import sourceReviews from '../../../server/seed/source_reviews.json';
import countySources from '../../../server/seed/county_sources.json';
import countyHealthPages from '../../../server/seed/county_health_candidates.json';
import foundLinks from '../../../server/seed/found_links.json';
import waPlaces from '../../../server/seed/wa_places.json';
import processingTimes from '../../../server/seed/processing_times.json';

const clone = (x) => JSON.parse(JSON.stringify(x));
const fresh = () => ({ rules: clone(rules), users: clone(users), checklists: clone(checklists), notifications: clone(notifications), source_reviews: clone(sourceReviews), county_sources: clone(countySources), accounts: clone(accountsSeed), events: clone(eventsSeed) });

export function createMemoryStore() {
  let data = fresh();
  return createDocStore({
    async read(name) {
      return clone(data[name]);
    },
    async write(name, value) {
      data[name] = clone(value);
    },
    async seed(name) {
      return clone({ rules, users, checklists, notifications, source_reviews: sourceReviews, county_sources: countySources, accounts: accountsSeed, events: eventsSeed }[name]);
    },
  });
}

// Replace window.fetch for /api calls. Everything else goes to the real fetch.
export function installMockServer() {
  const service = createService(createMemoryStore(), { adminEmails: ['admin@example.com'], demoResetLinks: true, countyHealthPages, foundLinks, places: waPlaces.places, processingTimes });
  const realFetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : null;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith('/api')) {
      if (!realFetch) throw new Error('Network is not available in the preview.');
      return realFetch(input, init);
    }
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : undefined;
    const h = new Headers(init.headers || {});
    const ctx = {
      visitor: h.get('x-visitor-id') || undefined,
      adminKey: h.get('x-admin-key') || '',
      session: (/^Bearer ([a-f0-9]{64})$/.exec(h.get('authorization') || '') || [])[1] || '',
    };
    const r = await service.handle(method, url, body, ctx);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
  };
  return service;
}
