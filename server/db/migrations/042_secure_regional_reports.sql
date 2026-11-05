-- 042_secure_regional_reports.sql
-- Restrict regional report database access to the HOSA server.

-- Ensure RLS remains enabled.
ALTER TABLE public.regional_reports
ENABLE ROW LEVEL SECURITY;

-- Remove the overly permissive policy.
DROP POLICY IF EXISTS
  "Admins can view all reports"
ON public.regional_reports;

-- Remove direct table privileges from Supabase API roles.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'anon'
  ) THEN
    REVOKE ALL PRIVILEGES
    ON TABLE public.regional_reports
    FROM anon;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'authenticated'
  ) THEN
    REVOKE ALL PRIVILEGES
    ON TABLE public.regional_reports
    FROM authenticated;
  END IF;
END $$;