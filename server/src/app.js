import { renderMessagePage } from './emailTemplate.js';
import express from 'express';
import cors from 'cors';
import { DISCLAIMER } from './disclaimer.js';
import { createStore } from './store.js';
import { createService } from './service.js';
import { createOllamaLlm } from './ollama.js';
import { createMailer } from './mailer.js';
import { readFileSync, existsSync } from 'node:fs';
import { SEED_DIR } from './store.js';
import path from 'node:path';

const VISITOR_RX = /^[A-Za-z0-9-]{8,64}$/;

// Small in-memory rate limiter (per IP). Enough for a demo; use a shared store behind many instances.
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    const rec = hits.get(key);
    if (!rec || now - rec.start > windowMs) hits.set(key, { start: now, count: 1 });
    else if (++rec.count > max) return res.status(429).json({ ok: false, error: 'Too many requests. Wait a minute and try again.' });
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k);
    return next();
  };
}

// Pages found by search live in seed files (reviewed pages live in the store). A missing file means none.
function loadSeedJson(name, fallback) {
  try {
    return JSON.parse(readFileSync(path.join(SEED_DIR, name), 'utf8'));
  } catch {
    return fallback;
  }
}

// Thin Express adapter. All API logic lives in service.js.
export function createApp({ dataDir, store = createStore(dataDir), adminKey = process.env.ADMIN_KEY, llm = createOllamaLlm(), mailer = createMailer(), countyHealthPages = loadSeedJson('county_health_candidates.json', { counties: [] }), foundLinks = loadSeedJson('found_links.json', { links: [] }), publicUrl = process.env.PUBLIC_URL, corsOrigins, places = loadSeedJson("wa_places.json", { places: [] }).places, processingTimes = loadSeedJson('processing_times.json', { times: [] }), clientDist = process.env.CLIENT_DIST, adminEmails = String(process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean), demoResetLinks = process.env.DEMO_RESET_LINKS === 'true', requireLogin = !['false', '0', 'no'].includes(String(process.env.REQUIRE_LOGIN || '').toLowerCase()), idp } = {}) {
  const production = process.env.NODE_ENV === 'production';
  const service = createService(store, { adminKey: adminKey || undefined, adminLocked: production && !adminKey, llm, mailer, publicUrl, adminEmails, demoResetLinks, requireLogin, idp, countyHealthPages, foundLinks, places, processingTimes });
  const app = express();
  app.set('trust proxy', Number.isInteger(Number(process.env.TRUST_PROXY)) && process.env.TRUST_PROXY !== '' ? Number(process.env.TRUST_PROXY) : 1);

  // Security headers. HSTS is sent only when the request really came in over HTTPS.
  app.disable('x-powered-by');
  const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'microphone=(self), camera=(), geolocation=()',
    });
    if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });

  const allowed = (corsOrigins ?? process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({
    origin(origin, cb) {
      // No Origin header (curl, same-origin, tests) or no list configured (local dev): allow.
      if (!origin || !allowed.length || allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    allowedHeaders: ['content-type', 'x-visitor-id', 'x-admin-key', 'authorization'],
  }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', rateLimit({ windowMs: 60_000, max: 240 }));
  app.use('/api/chat', rateLimit({ windowMs: 60_000, max: 20 }));
  app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 20 })); // sign in, sign up and reset: slow down guessing
  app.use((req, res, next) => {
    res.setHeader('X-Demo-Disclaimer', 'Demo only, not official guidance.');
    next();
  });

  // Pages opened from links inside emails (confirm and unsubscribe). Plain HTML, no scripts.
  const page = renderMessagePage;
  for (const [kind, title] of [['confirm', 'Reminder emails'], ['unsubscribe', 'Unsubscribe']]) {
    app.get(`/api/email/${kind}`, async (req, res, next) => {
      try {
        const { status, body } = await service.handle('GET', req.originalUrl, undefined, {});
        res.status(status).type('html').send(page(title, body.message || body.error));
      } catch (err) {
        next(err);
      }
    });
  }

  app.use('/api', async (req, res, next) => {
    try {
      const visitor = String(req.get('x-visitor-id') || '');
      const ctx = {
        visitor: VISITOR_RX.test(visitor) ? visitor : undefined,
        adminKey: req.get('x-admin-key') || '',
        session: (/^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(req.get('authorization') || '') || [])[1] || '',
      };
      const { status, body } = await service.handle(req.method, req.originalUrl, req.body, ctx);
      res.status(status).json(body);
    } catch (err) {
      next(err);
    }
  });

  // Optional: serve the built client from this server so a refresh or a shared link on any page opens the app, not "Not Found".
  // Set CLIENT_DIST to the client's dist folder. Unknown /api paths still answer with JSON, never with the page.
  if (clientDist && existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api(\/|$)).*/, (req, res) => res.sendFile(path.resolve(clientDist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status && err.status < 500 ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ ok: false, error: status === 500 ? 'Server error' : 'Bad request', disclaimer: DISCLAIMER });
  });

  app.store = store;
  app.service = service;
  return app;
}
