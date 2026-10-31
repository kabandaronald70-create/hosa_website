-- 035_projects.sql
-- Projects and Regional Development Module

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  region          TEXT NOT NULL, -- e.g., 'Central', 'Eastern', 'Northern', 'Western'
  category        TEXT NOT NULL, -- e.g., 'Infrastructure', 'Scholarship', 'Health'
  status          TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'in_progress', 'completed', 'cancelled')),
  budget          NUMERIC(12, 2) DEFAULT 0,
  funds_raised    NUMERIC(12, 2) DEFAULT 0,
  start_date      DATE,
  end_date        DATE,
  lead_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_status_idx ON projects (status);
CREATE INDEX IF NOT EXISTS projects_region_idx ON projects (region);

-- 2. Project Milestones
CREATE TABLE IF NOT EXISTS project_milestones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  target_date     DATE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_milestones_project_idx ON project_milestones (project_id);

-- 3. Triggers
CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Supabase Grants & RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view approved projects publicly
CREATE POLICY "Public can view approved projects" 
ON public.projects FOR SELECT 
USING (status IN ('approved', 'in_progress', 'completed'));

CREATE POLICY "Public can view project milestones" 
ON public.project_milestones FOR SELECT 
USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_milestones TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_milestones TO service_role;
    GRANT SELECT ON public.projects TO anon;
    GRANT SELECT ON public.project_milestones TO anon;
  END IF;
END $$;