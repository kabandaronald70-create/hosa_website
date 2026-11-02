-- 038_milestone_region.sql
ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS assigned_region TEXT;

-- Supabase Grants (safe to run multiple times)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_milestones TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_milestones TO service_role;
    GRANT SELECT ON public.project_milestones TO anon;
  END IF;
END $$;