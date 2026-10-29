-- Accounts and activity log. Passwords are stored only as salted PBKDF2 hashes inside the account document.
CREATE TABLE IF NOT EXISTS accounts (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data       JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id         BIGSERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type       TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS events_visitor_idx ON events (visitor_id, at DESC);
