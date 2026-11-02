-- 041_regional_reports.sql

CREATE TABLE IF NOT EXISTS regional_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region          TEXT NOT NULL,
  title           TEXT NOT NULL,
  -- 🚨 Updated to match the exact text from your HTML form
  report_type     TEXT NOT NULL CHECK (report_type IN ('Monthly Report', 'Quarterly Report', 'Incident Report', 'Annual Report')),
  content         TEXT NOT NULL,
  file_path       TEXT,
  file_name       TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
  submitted_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS regional_reports_region_idx ON regional_reports (region);
CREATE INDEX IF NOT EXISTS regional_reports_status_idx ON regional_reports (status);

-- Supabase Grants & RLS
ALTER TABLE public.regional_reports ENABLE ROW LEVEL SECURITY;

-- 🚨 ADDED DROP POLICY IF EXISTS SO IT DOESN'T CRASH ON REDEPLOY
DROP POLICY IF EXISTS "Admins can view all reports" ON public.regional_reports;

CREATE POLICY "Admins can view all reports" 
ON public.regional_reports FOR SELECT 
USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.regional_reports TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.regional_reports TO service_role;
  END IF;
END $$;