# WA Business One-Stop-Shop: proof of concept (DEMO ONLY)

Demo only, not official guidance. Not legal advice. Confirm every requirement with each agency. Not a live product.

A rules-first checklist for new Washington business owners. Written rules decide what applies. No AI picks requirements. The only "suggestion" is a simple keyword match that the owner confirms.

## What you get

| Screen | Route | What it does |
| --- | --- | --- |
| Home | `/` | Landing page and three sample businesses |
| Questionnaire | `/questionnaire` | Up to ten adaptive questions, one at a time, with a review step |
| My checklist | `/checklist` | Ordered, grouped steps with reason, source, verification status and apply links. Mark steps done. A "left out" list explains omissions |
| Progress | `/dashboard` | Overall progress, next step, progress by phase, renewal dates you enter |
| Notifications | `/notifications` | Simulated renewal reminders and rule-change alerts. No email is ever sent |
| Admin rules | `/admin` | Edit a rule, see a side-by-side change, approve with a reviewer name, change history |
| Sources | `/sources` | Official pages used, what is simulated, every rule's source and verification status |

The demo disclaimer bar is rendered by one shared layout, so it appears on every screen. A test checks this for every route.

## Requirements

Node.js 20 or newer (includes npm). Check with `node -v`.

## Run locally (Windows PowerShell)

```
cd wa-one-stop-poc
npm install
npm run dev
```

Open http://localhost:5173. The API runs on http://localhost:3001 and Vite forwards `/api` to it.
Press `Ctrl+C` to stop.

## Test

```
npm test
```

Runs 24 server tests (rules engine and API) and 14 client tests.

## Build check

```
npm run build
```

## Project layout

```
wa-one-stop-poc/
  package.json             npm workspaces: client and server
  prototype/               copy of the Claude Artifact (single HTML file)
  server/
    seed/                  original JSON: rules, users, checklists, notifications
    data/                  working copy, created on first run (git-ignored)
    src/engine.js          deterministic rules engine
    src/app.js             Express API
    src/store.js           JSON file store
    src/samples.js         the three sample businesses (answers only)
    test/                  engine and API tests
  client/
    src/pages/             one file per screen
    src/components/        layout, disclaimer banner, checklist item, shared parts
    src/api.js             API calls
    src/questions.js       questionnaire wording
    src/styles/global.css  design tokens, light and dark themes
```

## How the rules engine works

Each rule in `server/seed/rules.json` is a record with an `applies` condition, a reason for each outcome, a source, an apply link, an owner, a verification status and a last-verified date.

| Condition form | Meaning |
| --- | --- |
| `{ "always": true }` | Applies to everyone |
| `{ "field": "hiring", "is": "yes" }` | Applies when the answer matches |
| `{ "field": "structure", "in": ["llc", "corp"] }` | Applies when the answer is in the list |
| `{ "field": "cats", "includes": "food" }` | Applies when the chosen types include a value |
| `{ "any": [ ... ] }` and `{ "all": [ ... ] }` | Combine conditions |

Three outcomes are possible: **applies**, **maybe** (an answer was "not sure" or missing) and **left out** (with the reason kept). The same answers always give the same result.

### Add or change a rule

1. Edit `server/seed/rules.json`. Keep one official source link on every rule.
2. Add a test case in `server/test/engine.test.js`.
3. Delete `server/data/` (or use "Reset demo data" on the Admin screen) so the working copy reloads from the seed.
4. Run `npm test`.

Do not set `verification.status` to `checked` until a second person has read the official page and you have set `lastVerified`.

## API summary

| Method and path | Purpose |
| --- | --- |
| `GET /api/health`, `GET /api/status` | Server and data checks |
| `GET /api/samples` | Sample businesses |
| `POST /api/suggest` | Simulated keyword suggestion |
| `POST /api/evaluate` | Run the engine on answers without saving |
| `GET, POST, DELETE /api/checklist` | The saved checklist for the sandbox user |
| `PATCH /api/checklist/done`, `PUT /api/checklist/renewal` | Mark done; store a renewal date |
| `GET /api/dashboard` | Progress summary |
| `GET /api/notifications`, `POST /api/notifications/renewal-reminder`, `PUT /api/settings` | Simulated notifications |
| `GET /api/rules`, `PUT /api/rules/:id/draft`, `POST /api/rules/:id/publish`, `GET /api/changes` | Admin rule management |
| `POST /api/demo/reset` | Restore seed data |

## Source status

| Rule | Status |
| --- | --- |
| Secretary of State first for entities, DOR license triggers, processing times, fee note, wizard link | Read on the DOR page on October 26, 2026 |
| L&I contractor registration, workers' compensation, ESD employer taxes, DSHS new-hire reporting, independent contractors, county health permit, local requirements | Named by official pages. Second-person check pending. The DSHS 20-day figure is unconfirmed team research |

No fee amounts and no local city rules are included on purpose. Links to L&I go to its home page because no verified deep link is on record.

## Known limits (by design for a POC)

- One sandbox user and no sign-in. WA.gov accounts are an open question for the design partner.
- The admin screen has no access control.
- Data is stored in local JSON files. Not for real owner data.
- Status is self-reported. No agency feed is connected.
- No Spanish or other translations yet.
- Accessibility: built toward WCAG 2.1 AA-aligned practice. It has not been scanned or tested with a screen reader. Do not call it compliant or certified.

## Guided checklist (added)

Each checklist step has a Guide: what it means, why it applies, who it applies to, conditions and exceptions, what to prepare, steps, dated agency-stated amounts and timing, and why a link leaves the site. Text lives in `server/seed/rules.json` under `guide`. Applicability is still decided only by the rules in `rules.json` and `server/src/engine.js`.

- Checked: someone read the official page and it supports the rule.
- Approved: a named reviewer approved the record in the admin screen.
- Pending verification: health, esd and local. No requirement beyond what is shown is asserted.
- Progress and notifications are simulated.


## Database, chat and deploy

### Storage
- With `DATABASE_URL` set, the server saves to PostgreSQL. It creates its tables and loads the 10 seed rules on start. Without it, the server uses JSON files in `server/data` (local development only).
- Rules are shared. Each browser gets an anonymous id (kept in `localStorage`) and its own saved checklist, county, progress, renewal dates, notifications and email setting.
- Use a NEW database for this app (for example `checklist_app`), not the event-discovery one.
- Create the database once with `npm run db:create -w server` (set `ADMIN_DATABASE_URL` to your server's `postgres` database first, and optionally `DB_NAME`). Or create it by hand: `CREATE DATABASE checklist_app;` in pgAdmin.
- Put secrets in `server/.env` (see `server/.env.example`). Never commit it. The repo ignores it.

### Admin key
- Set `ADMIN_KEY` on the server. The Admin screen then asks for it. Editing rules, publishing and resetting need the key. Reading rules and sources stays public.
- With `NODE_ENV=production` and no `ADMIN_KEY`, admin stays locked.
- The key is typed in the browser, kept for that tab only, and sent as an `X-Admin-Key` header. It is not in the frontend code.

### Chat
- The side panel calls `POST /api/chat` with the question and the last 8 turns.
- Answers use only the rule records and guides. Links come only from the stored `apply` and `source` URLs. If nothing matches, it says so.
- `OLLAMA_BASE_URL` empty (the free host): answers come straight from the records. Set it locally to let `llama3.2:3b` reword the answer. A reworded answer is thrown away if it adds a link or number that is not in the records.
- Chat history is not stored. Only the checklist data is.

### Deploy to Render (free plan)
1. Push the project to GitHub.
2. In Render choose New > Blueprint and pick the repo. `render.yaml` creates `wa-onestop-api` (web service, root `server`) and `wa-onestop-ui` (static site, root `client`).
3. On the API service set `DATABASE_URL` (Neon, new database), `ADMIN_KEY` (long random string) and `CORS_ORIGINS` (the UI URL).
4. On the UI service set `VITE_API_BASE_URL` to the API URL.
5. Open `/api/health` on the API. It should say `"storage":"postgres"`.
6. The free API sleeps when idle. The first request can take 30 to 60 seconds. The UI shows a waking-up message.

### Tests
- `npm test` runs server and client tests.
- `npm run test:pg -w server` runs the PostgreSQL tests. They use `TEST_DATABASE_URL` if set. Otherwise they start an embedded PostgreSQL, which must run as a non-root user. They skip with a message when neither is possible.
