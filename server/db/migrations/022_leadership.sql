-- 022_leadership.sql
-- Table for tracking association leadership and governance roles

CREATE TABLE IF NOT EXISTS leadership_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  office_title  TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('Executive Committee', 'Board of Trustees', 'Secretariat')),
  term_start    DATE,
  term_end      DATE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past', 'vacant')),
  display_order INT DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leadership_roles_status_idx ON leadership_roles (status);

CREATE TRIGGER leadership_roles_set_updated_at
  BEFORE UPDATE ON leadership_roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

  DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.leadership_roles TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.leadership_roles TO service_role;
    GRANT SELECT ON public.leadership_roles TO anon;
  END IF;
END $$;