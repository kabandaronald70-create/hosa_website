CREATE TABLE announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  author_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX announcements_pinned_idx ON announcements (pinned DESC, created_at DESC);

CREATE TRIGGER announcements_set_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();