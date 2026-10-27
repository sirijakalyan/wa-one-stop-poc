-- Optional email reminders. Email is personal data: store it only after opt-in, delete it on reset or unsubscribe request.
ALTER TABLE visitor_settings ADD COLUMN IF NOT EXISTS email           TEXT;
ALTER TABLE visitor_settings ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE visitor_settings ADD COLUMN IF NOT EXISTS email_token     TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS visitor_settings_token_idx ON visitor_settings (email_token) WHERE email_token IS NOT NULL;

-- One row per reminder already sent, so a reminder is never sent twice.
CREATE TABLE IF NOT EXISTS reminder_log (
  visitor_id    TEXT NOT NULL,
  reminder_key  TEXT NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (visitor_id, reminder_key)
);
