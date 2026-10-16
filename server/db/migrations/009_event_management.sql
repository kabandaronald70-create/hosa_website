-- 009_event_management.sql
-- Extra fields for admin-managed events.

ALTER TABLE events
  ADD COLUMN internal_notes TEXT
    CHECK (internal_notes IS NULL OR char_length(internal_notes) <= 2000);

CREATE INDEX events_status_published_starts_idx
  ON events (status, starts_at DESC)
  WHERE status = 'published';