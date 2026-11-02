-- 039_project_funding.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS funds_raised NUMERIC(12, 2) DEFAULT 0;

-- Supabase Grants (safe to run multiple times)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO service_role;
    GRANT SELECT ON public.projects TO anon;
  END IF;
END $$;