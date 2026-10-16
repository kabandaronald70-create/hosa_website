-- 008_moderation.sql
-- Moderation metadata for stories and opportunities.

ALTER TABLE stories
  ADD COLUMN rejection_reason TEXT
    CHECK (rejection_reason IS NULL OR char_length(rejection_reason) <= 500),
  ADD COLUMN moderation_notes TEXT
    CHECK (moderation_notes IS NULL OR char_length(moderation_notes) <= 2000);

ALTER TABLE opportunities
  ADD COLUMN rejection_reason TEXT
    CHECK (rejection_reason IS NULL OR char_length(rejection_reason) <= 500),
  ADD COLUMN moderation_notes TEXT
    CHECK (moderation_notes IS NULL OR char_length(moderation_notes) <= 2000);

-- Indexes for the moderation queue view (only pending items).
CREATE INDEX stories_pending_idx
  ON stories (created_at DESC)
  WHERE status = 'pending';

CREATE INDEX opportunities_pending_idx
  ON opportunities (created_at DESC)
  WHERE status = 'pending';