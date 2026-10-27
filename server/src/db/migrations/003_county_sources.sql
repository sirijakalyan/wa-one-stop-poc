-- Verified county health department pages. A county link may be shown only after its page is reviewed.
-- county is the lowercase county name without the word "county" (for example: king).
CREATE TABLE IF NOT EXISTS county_sources (
  county       TEXT PRIMARY KEY,
  official_url TEXT NOT NULL,
  reviewed_by  TEXT NOT NULL,
  reviewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status       TEXT NOT NULL CHECK (status IN ('verified', 'pending'))
);
CREATE INDEX IF NOT EXISTS county_sources_status_idx ON county_sources (status);
