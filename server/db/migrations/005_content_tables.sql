-- 005_content_tables.sql
-- Content tables for events, opportunities, stories, and public directory aliases.

-- -------------------------------------------------------------------
-- 1. Add fields to member_profiles that the directory needs.
-- -------------------------------------------------------------------
ALTER TABLE member_profiles
  ADD COLUMN mentor_field        TEXT CHECK (mentor_field IS NULL OR char_length(mentor_field) <= 80),
  ADD COLUMN seed_ref            TEXT UNIQUE;   -- e.g. 'm001' for imported data

CREATE INDEX member_profiles_seed_ref_idx ON member_profiles (seed_ref) WHERE seed_ref IS NOT NULL;

-- -------------------------------------------------------------------
-- 2. Events
-- -------------------------------------------------------------------
CREATE TABLE events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  starts_at      TIMESTAMPTZ NOT NULL,
  ends_at        TIMESTAMPTZ,
  timezone       TEXT NOT NULL DEFAULT 'Africa/Kampala',
  venue          TEXT,
  capacity       INTEGER CHECK (capacity IS NULL OR capacity > 0),
  registration_deadline TIMESTAMPTZ,
  accessibility  TEXT,
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'published', 'cancelled', 'archived')),
  published_at   TIMESTAMPTZ,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX events_status_starts_idx ON events (status, starts_at DESC);

CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE event_rsvps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('going', 'maybe', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX event_rsvps_event_idx ON event_rsvps (event_id);
CREATE INDEX event_rsvps_user_idx  ON event_rsvps (user_id);

CREATE TRIGGER event_rsvps_set_updated_at
  BEFORE UPDATE ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -------------------------------------------------------------------
-- 3. Opportunity categories + opportunities
-- -------------------------------------------------------------------
CREATE TABLE opportunity_categories (
  id      SMALLSERIAL PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  active  BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO opportunity_categories (name) VALUES
  ('Jobs'), ('Internships'), ('Scholarships'), ('Volunteering'), ('Training')
ON CONFLICT DO NOTHING;

CREATE TABLE opportunities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  category_id    SMALLINT REFERENCES opportunity_categories(id) ON DELETE SET NULL,
  description    TEXT NOT NULL DEFAULT '',
  organization   TEXT,
  location       TEXT,
  application_url TEXT CHECK (application_url IS NULL OR application_url ~ '^https?://'),
  deadline       DATE,
  submitted_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected', 'archived', 'expired')),
  reviewed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX opportunities_status_idx   ON opportunities (status);
CREATE INDEX opportunities_category_idx ON opportunities (category_id);
CREATE INDEX opportunities_deadline_idx ON opportunities (deadline);

CREATE TRIGGER opportunities_set_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -------------------------------------------------------------------
-- 4. Stories
-- -------------------------------------------------------------------
CREATE TABLE stories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  excerpt       TEXT,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  image_path    TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('draft', 'pending', 'published', 'rejected', 'archived')),
  reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX stories_status_published_idx ON stories (status, published_at DESC);

CREATE TRIGGER stories_set_updated_at
  BEFORE UPDATE ON stories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();