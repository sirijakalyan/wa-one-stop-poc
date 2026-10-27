-- Evidence behind "Pending verification": who reviewed which official page, when, and the result.
-- Recording a review does NOT change a rule's status or approval. A named reviewer still publishes in Admin.
-- Do not put personal data in notes. Reviewer is the reviewer's work name only.
CREATE TABLE IF NOT EXISTS source_reviews (
  id          TEXT PRIMARY KEY,
  rule_id     TEXT NOT NULL,
  source_url  TEXT NOT NULL,
  reviewed_by TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result      TEXT NOT NULL CHECK (result IN ('checked', 'pending')),
  notes       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS source_reviews_rule_idx ON source_reviews (rule_id);
CREATE INDEX IF NOT EXISTS source_reviews_reviewed_at_idx ON source_reviews (reviewed_at);
