import { createApp } from './app.js';
import { createStore } from './store.js';
import { createPgStore } from './db/pgStore.js';
import { createPool, isDatabaseConfigured } from './db/pool.js';

// Load server/.env when present (Node 20.12+). Render sets real env vars instead.
try { process.loadEnvFile?.(new URL('../.env', import.meta.url)); } catch { /* no .env file */ }

const port = Number(process.env.PORT) || 3001;

async function main() {
  let store;
  if (isDatabaseConfigured()) {
    store = createPgStore(createPool());
    await store.init((m) => console.log(`[db] ${m}`));
    console.log('Storage: PostgreSQL');
  } else {
    store = createStore();
    console.log('Storage: JSON files in server/data (set DATABASE_URL to use PostgreSQL)');
  }
  const app = createApp({ store });
  app.listen(port, () => console.log(`WA One-Stop-Shop server listening on port ${port}`));

  // Send due renewal reminders once an hour (and once at start). Each reminder is sent only once.
  const tick = () => app.service.runReminders().then((r) => { if (r.sent || r.failed) console.log(`[email] reminders: ${r.sent} sent, ${r.failed} failed`); }).catch((e) => console.error('[email] reminder run failed:', e.message));
  setTimeout(tick, 5000).unref();
  setInterval(tick, 60 * 60 * 1000).unref();
}

main().catch((err) => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});
