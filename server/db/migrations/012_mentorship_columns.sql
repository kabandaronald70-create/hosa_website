-- 012_mentorship_columns.sql
-- Add the three lifecycle columns that 011 should have added but didn't
-- (because mentorship_requests didn't exist when 011 ran on this database).

ALTER TABLE mentorship_requests
  ADD COLUMN IF NOT EXISTS declined_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS saved_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type       TEXT NOT NULL
                  CHECK (item_type IN ('event','story','opportunity','member')),
  item_id         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS saved_items_user_idx ON saved_items (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS saved_items_target_idx ON saved_items (item_type, item_id);

CREATE INDEX IF NOT EXISTS event_rsvps_user_status_idx
  ON event_rsvps (user_id, status, updated_at DESC);