-- 010_submission_metadata.sql
-- Track who submitted each story/opportunity and give them a status filter index.

-- Stories: submitted_by_user_id (author_user_id already exists but is nullable and
-- was populated by the importer as NULL for seed stories).
ALTER TABLE stories
  ADD COLUMN submitted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Opportunities: submitted_by already exists but as a nullable column; ensure index.
CREATE INDEX stories_submitted_by_idx
  ON stories (submitted_by_user_id, created_at DESC)
  WHERE submitted_by_user_id IS NOT NULL;

CREATE INDEX opportunities_submitted_by_idx
  ON opportunities (submitted_by, created_at DESC)
  WHERE submitted_by IS NOT NULL;