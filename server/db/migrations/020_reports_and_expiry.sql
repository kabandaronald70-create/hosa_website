-- 020_reports_and_expiry.sql
-- 1. Create the reports table
CREATE TABLE IF NOT EXISTS reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type   TEXT NOT NULL CHECK (target_type IN ('story', 'opportunity')),
  target_id     UUID NOT NULL,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_target_idx ON reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status);

-- 2. Add a `status` column to opportunities (if it doesn't already exist) 
-- to track 'open', 'closed', 'draft', etc.
ALTER TABLE opportunities 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open' 
  CHECK (status IN ('open', 'closed', 'draft', 'archived'));

-- 3. Create an index to make the expiry query fast
CREATE INDEX IF NOT EXISTS opportunities_deadline_idx ON opportunities (deadline) WHERE status = 'open';