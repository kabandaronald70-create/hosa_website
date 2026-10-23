-- 027_business_requests.sql
-- Board for business-to-business networking and opportunities

CREATE TABLE IF NOT EXISTS business_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type    TEXT NOT NULL CHECK (request_type IN ('seeking', 'offering', 'partnership')),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  contact_method  TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
  expires_at      TIMESTAMPTZ, -- Optional expiration date
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_requests_status_idx ON business_requests (status);
CREATE INDEX IF NOT EXISTS business_requests_user_idx ON business_requests (user_id);

CREATE TRIGGER business_requests_set_updated_at
  BEFORE UPDATE ON business_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Supabase Grants
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_requests TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_requests TO service_role;
    GRANT SELECT ON public.business_requests TO anon;
  END IF;
END $$;