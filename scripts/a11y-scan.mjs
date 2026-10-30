#!/usr/bin/env node
// Accessibility check you can run before deploying:   npm run a11y
//
// What it does
//   1. Builds the client (skip with --skip-build) and starts the site on this computer with a throwaway data
//      folder, so your real data in server/data is never touched.
//   2. Creates a demo owner (with a saved plan) and a demo admin.
//   3. Scans every page with axe-core, the same engine SureAccess uses, signed out, as an owner and as an admin,
//      on a desktop and a phone screen. It also opens the chat panel and the admin editor.
//   4. Loads the real web fonts (the site uses Google Fonts). Real fonts change text sizes and caused a finding
//      that a scan without them missed.
//   5. Prints every problem with the exact element. Exit code 0 means no violations and nothing needing review.
//
// Options:  --skip-build   reuse client/dist        --allow-review   do not fail on "needs review" items
//           --keep         leave the temp data      --verbose        print every page, not only problems
//           --strict       also fail on advisory notes about the chat pop-up
//
// It checks what a machine can check (WCAG 2.2 AA-aligned rules). It does not prove conformance: a person
// still has to review the rest.

import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const args = new Set(process.argv.slice(2));
const PASSWORD = 'A11y-Check-Pass-2026';
const OWNER = 'a11y-owner@example.test';
const ADMIN = 'a11y-admin@example.test';

function need(name) {
  try { return require.resolve(name, { paths: [ROOT] }); } catch {
    console.error(`Missing ${name}. Run "npm install" in the project folder first, then "npx playwright install chromium".`);
    process.exit(2);
  }
}
const axeFile = need('axe-core/axe.min.js');
const figtreeDir = path.dirname(need('@fontsource/figtree/package.json')) + '/files/';
const bricolage = path.dirname(need('@fontsource-variable/bricolage-grotesque/package.json')) + '/files/bricolage-grotesque-latin-wght-normal.woff2';
const pw = require(need('playwright'));
const chromium = pw.chromium;
const axeSrc = readFileSync(axeFile, 'utf8');

const FONT_CSS = [400, 500, 600, 700, 800].map((w) => `@font-face{font-family:'Figtree';font-weight:${w};font-style:normal;src:url(https://fonts.gstatic.com/a11y/fig${w}.woff2) format('woff2')}`).join('\n')
  + "\n@font-face{font-family:'Bricolage Grotesque';font-weight:200 800;font-style:normal;src:url(https://fonts.gstatic.com/a11y/bric.woff2) format('woff2')}";

const freePort = () => new Promise((resolve, reject) => { const s = createServer(); s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); s.on('error', reject); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Build
if (!args.has('--skip-build')) {
  console.log('Building the client...');
  const b = spawnSync('npm', ['run', 'build', '-w', 'client'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (b.status !== 0) { console.error('Build failed.'); process.exit(2); }
}
if (!existsSync(path.join(ROOT, 'client/dist/index.html'))) { console.error('client/dist is missing. Run without --skip-build.'); process.exit(2); }

// 2. Start the site with a throwaway data folder
const dataDir = mkdtempSync(path.join(tmpdir(), 'a11y-data-'));
const port = await freePort();
const BASE = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server/src/index.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(port), DATABASE_URL: '', WA_DATA_DIR: dataDir, CLIENT_DIST: path.join(ROOT, 'client/dist'), ADMIN_EMAILS: ADMIN, COGNITO_USER_POOL_ID: '', EMAIL_PROVIDER: 'log', SECRETS_ID: '', ADMIN_KEY: '', NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });
const cleanup = () => { try { server.kill(); } catch { /* already stopped */ } if (!args.has('--keep')) { try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* ignore */ } } };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

for (let i = 0; i < 60; i++) { try { const r = await fetch(`${BASE}/api/health`); if (r.ok) break; } catch { /* not up yet */ } await sleep(250); if (i === 59) { console.error('The site did not start.\n' + serverLog); process.exit(2); } }

async function api(method, url, body, token) {
  const r = await fetch(BASE + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function account(email, name) {
  await api('POST', '/api/auth/signup', { name, email, password: PASSWORD });
  const r = await api('POST', '/api/auth/login', { email, password: PASSWORD });
  if (!r.data.token) { console.error(`Could not sign in the demo account ${email}:`, r.data); process.exit(2); }
  return { token: r.data.token, refresh: r.data.refreshToken || '' };
}
const owner = await account(OWNER, 'Demo Owner');
const admin = await account(ADMIN, 'Demo Admin');
await api('POST', '/api/checklist', { label: 'Demo restaurant', answers: { structure: 'llc', desc: 'Neighborhood restaurant serving lunch and dinner', cats: ['food'], city: 'Bellevue', county: 'King', hiring: 'yes', subs: 'yes', salestax: 'yes', income: 'yes', tradename: 'yes' } }, owner.token);

// 3. Scan
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const VIEWPORTS = [['desktop', { width: 1280, height: 900 }], ['phone', { width: 375, height: 800 }]];
const SETS = [
  { who: 'signed out', session: null, pages: ['/', '/home', '/login', '/signup', '/forgot-password', '/reset-password', '/guide', '/questionnaire'] },
  { who: 'owner', session: owner, pages: ['/home', '/my-business', '/notifications', '/sources', '/guide'] },
  { who: 'admin', session: admin, pages: ['/admin?tab=rules', '/admin?tab=questions', '/admin?tab=people'] },
];

const browser = await chromium.launch();
const problems = new Map(); // key -> { where:Set, kind, rule, target, why, help }
let checks = 0;

async function scan(page, label) {
  await page.evaluate(axeSrc);
  const r = await page.evaluate((tags) => axe.run(document, { runOnly: { type: 'tag', values: tags } }), TAGS);
  checks += 1;
  let n = 0;
  for (const [kind, list] of [['VIOLATION', r.violations], ['NEEDS REVIEW', r.incomplete]]) {
    for (const v of list) for (const node of v.nodes) {
      n += 1;
      const why = ((node.any[0] || node.all[0] || node.none[0] || {}).message || '').slice(0, 140);
      // The chat pop-up is a floating panel that SureAccess never opens. Its "needs review" items are advisory unless --strict.
      const k = kind === 'NEEDS REVIEW' && /chat panel open/.test(label) && !args.has('--strict') ? 'ADVISORY (SureAccess does not open this)' : kind;
      const key = `${k}|${v.id}|${node.target.join(' ')}`;
      if (!problems.has(key)) problems.set(key, { where: new Set(), kind: k, rule: v.id, target: node.target.join(' '), why, help: v.help });
      problems.get(key).where.add(label);
    }
  }
  if (args.has('--verbose') || n) console.log(`${n ? '  x' : '  ok'} ${label}${n ? `  (${n})` : ''}`);
}

for (const set of SETS) {
  for (const [vpName, viewport] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport });
    await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: FONT_CSS }));
    await ctx.route('https://fonts.gstatic.com/a11y/**', (r) => {
      const m = r.request().url().match(/fig(\d+)/);
      r.fulfill({ contentType: 'font/woff2', body: readFileSync(m ? `${figtreeDir}figtree-latin-${m[1]}-normal.woff2` : bricolage) });
    });
    if (set.session) await ctx.addInitScript(([t, rf]) => { try { localStorage.setItem('wa-session', t); if (rf) localStorage.setItem('wa-refresh', rf); } catch { /* ignore */ } }, [set.session.token, set.session.refresh]);
    const page = await ctx.newPage();
    console.log(`\n${set.who} / ${vpName}`);
    for (const p of set.pages) {
      try {
        await page.goto(BASE + p, { waitUntil: 'networkidle' });
        await page.waitForTimeout(900);
        await scan(page, `${set.who} ${vpName} ${p}`);
        // Extra states
        if (p === '/' || p === '/home') {
          const fab = page.locator('.chat-fab');
          if (await fab.count()) { await fab.first().click(); await page.waitForTimeout(700); await scan(page, `${set.who} ${vpName} ${p} (chat panel open)`); }
        }
        if (p === '/admin?tab=rules') {
          const tile = page.locator('.board-grid .tile').nth(1);
          if (await tile.count()) { await tile.click(); await page.waitForTimeout(700); await scan(page, `${set.who} ${vpName} ${p} (step editor)`); }
          const add = page.getByRole('button', { name: /Add a step/ });
          if (await add.count()) { await add.first().click(); await page.waitForTimeout(700); await scan(page, `${set.who} ${vpName} ${p} (add a step)`); }
        }
      } catch (e) {
        console.log(`  ! ${set.who} ${vpName} ${p}: could not be scanned (${String(e.message).split('\n')[0]})`);
        problems.set(`ERROR|${set.who}|${vpName}|${p}`, { where: new Set([`${set.who} ${vpName} ${p}`]), kind: 'NOT SCANNED', rule: 'page-error', target: p, why: String(e.message).split('\n')[0], help: '' });
      }
    }
    // The first paint matters too: scan the home page right after load, before things settle.
    if (!set.session) {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 8000 }).catch(() => {});
      await scan(page, `${set.who} ${vpName} / (scanned right after load)`);
    }
    await ctx.close();
  }
}
await browser.close();

// 4. Report
const list = [...problems.values()];
const violations = list.filter((p) => p.kind === 'VIOLATION' || p.kind === 'NOT SCANNED');
const reviews = list.filter((p) => p.kind === 'NEEDS REVIEW');
const advisory = list.filter((p) => p.kind.startsWith('ADVISORY'));
console.log(`\nScanned ${checks} page states with axe-core. Real web fonts loaded.`);
for (const p of list) {
  console.log(`\n${p.kind}: ${p.rule}${p.help ? ` - ${p.help}` : ''}\n  element: ${p.target}\n  why: ${p.why}\n  seen on: ${[...p.where].slice(0, 4).join('; ')}${p.where.size > 4 ? ` (+${p.where.size - 4} more)` : ''}`);
}
console.log(`\nResult: ${violations.length} violation(s), ${reviews.length} needs-review item(s)${advisory.length ? `, ${advisory.length} advisory note(s) for the chat pop-up (add --strict to fail on these)` : ''}.`);
const fail = violations.length > 0 || (reviews.length > 0 && !args.has('--allow-review'));
console.log(fail ? 'NOT CLEAN. Fix the items above before deploying.' : 'CLEAN. Safe to deploy as far as machine checks go. A person still reviews the rest.');
cleanup();
process.exit(fail ? 1 : 0);
