-- WA One-Stop checklist app. Rules are shared; checklist data is per anonymous visitor id.
CREATE TABLE IF NOT EXISTS rule_meta (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS rules (
  id       TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  data     JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS rule_changes (
  id   TEXT PRIMARY KEY,
  at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS checklists (
  visitor_id TEXT PRIMARY KEY,
  answers    JSONB NOT NULL,
  label      TEXT NOT NULL DEFAULT '',
  done       JSONB NOT NULL DEFAULT '{}'::jsonb,
  renewals   JSONB NOT NULL DEFAULT '{}'::jsonb,
  saved_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  type       TEXT NOT NULL,
  simulated  BOOLEAN NOT NULL DEFAULT TRUE,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_visitor_idx ON notifications (visitor_id, created_at);

CREATE TABLE IF NOT EXISTS visitor_settings (
  visitor_id     TEXT PRIMARY KEY,
  email_opt_in   BOOLEAN NOT NULL DEFAULT FALSE
);
