-- 040_link_contributions_to_projects.sql
ALTER TABLE contributions 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contributions_project_idx ON contributions (project_id);

-- Supabase Grants
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.contributions TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.contributions TO service_role;
    GRANT SELECT ON public.contributions TO anon;
  END IF;
END $$;