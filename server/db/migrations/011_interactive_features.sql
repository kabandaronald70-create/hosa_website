-- 011_interactive_features.sql
-- Server-side saved items, mentorship request lifecycle, RSVP audit fields.

-- ---------- 1. mentorship_requests: create if missing ----------
CREATE TABLE IF NOT EXISTS mentorship_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  field_of_interest  TEXT NOT NULL,
  goals              TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','accepted','declined','completed','cancelled')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mentorship_requests_requester_idx
  ON mentorship_requests (requester_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mentorship_requests_mentor_idx
  ON mentorship_requests (mentor_user_id, created_at DESC);

-- updated_at trigger (idempotent)
DROP TRIGGER IF EXISTS mentorship_requests_set_updated_at ON mentorship_requests;
CREATE TRIGGER mentorship_requests_set_updated_at
  BEFORE UPDATE ON mentorship_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- 2. Add lifecycle columns (safe if already added) ----------
ALTER TABLE mentorship_requests
  ADD COLUMN IF NOT EXISTS declined_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMPTZ;

-- ---------- 3. Saved items ----------
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

-- ---------- 4. RSVP lookup index ----------
CREATE INDEX IF NOT EXISTS event_rsvps_user_status_idx
  ON event_rsvps (user_id, status, updated_at DESC);