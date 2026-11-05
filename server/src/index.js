import { createApp } from './app.js';
import { loadSecrets } from './secrets.js';
import { createCognitoIdp } from './cognito.js';
import { createStore } from './store.js';
import { createPgStore } from './db/pgStore.js';
import { createPool, isDatabaseConfigured } from './db/pool.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load server/.env when present (Node 20.12+). Render sets real env vars instead.
try { process.loadEnvFile?.(new URL('../.env', import.meta.url)); } catch { /* no .env file */ }

const port = Number(process.env.PORT) || 3001;

// A common slip: the key typed into .env.example (never read, and committed to GitHub). Say so plainly.
try {
  if (!process.env.ANTHROPIC_API_KEY?.trim() && /^ANTHROPIC_API_KEY=\S+/m.test(readFileSync(new URL('../.env.example', import.meta.url), 'utf8'))) {
    console.warn('WARNING: ANTHROPIC_API_KEY is in server/.env.example, which is not read and is committed to GitHub. Run "npm run setup:local" to move it to server/.env.');
  }
} catch { /* no example file */ }

async function main() {
  // Secrets first (database address, SendGrid key, admin key), so every module below sees them.
  const sec = await loadSecrets();
  if (process.env.SECRETS_ID) console.log(`Secrets: loaded ${sec.loaded} setting(s) from AWS Secrets Manager`);
  let store;
  if (isDatabaseConfigured()) {
    store = createPgStore(createPool());
    await store.init((m) => console.log(`[db] ${m}`));
    console.log('Storage: PostgreSQL');
  } else {
    store = createStore(process.env.WA_DATA_DIR || undefined);
    console.log(process.env.WA_DATA_DIR ? `Storage: JSON files in ${process.env.WA_DATA_DIR}` : 'Storage: JSON files in server/data (set DATABASE_URL to use PostgreSQL)');
  }
  // Serve the built client without any setting: use CLIENT_DIST if given, else client/dist (or ./dist) next to the server.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [process.env.CLIENT_DIST, path.resolve(here, '../../client/dist'), path.resolve(here, '../client/dist'), path.resolve(here, '../dist')].filter(Boolean);
  const clientDist = candidates.find((d) => existsSync(path.join(d, 'index.html')));
  console.log(clientDist ? `Client: serving ${clientDist}` : 'Client: no built client found (run "npm run build"); only /api is served');
  // People and passwords live in AWS Cognito when a user pool is configured. Otherwise the app keeps demo accounts in its own store.
  const adminEmails = String(process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);
  const idp = process.env.COGNITO_USER_POOL_ID ? createCognitoIdp({ userPoolId: process.env.COGNITO_USER_POOL_ID, clientId: process.env.COGNITO_CLIENT_ID, region: process.env.AWS_REGION, adminEmails }) : undefined;
  console.log(idp ? 'Sign in: AWS Cognito' : 'Sign in: accounts in the app store (set COGNITO_USER_POOL_ID to use AWS Cognito)');
  const app = createApp({ store, clientDist, idp });
  app.listen(port, () => console.log(`WA One-Stop-Shop server listening on port ${port}`));

  // Send due renewal reminders once an hour (and once at start). Each reminder is sent only once.
  const tick = () => app.service.runReminders(new Date(), '', { atSendTime: true }).then((r) => { if (r.sent || r.failed) console.log(`[email] reminders: ${r.sent} sent, ${r.failed} failed`); }).catch((e) => console.error('[email] reminder run failed:', e.message));
  setTimeout(tick, 5000).unref();
  setInterval(tick, 60 * 60 * 1000).unref();
}

main().catch((err) => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});
