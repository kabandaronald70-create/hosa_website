-- 036_project_roles_and_files.sql

-- 1. Project Attachments (Files)
CREATE TABLE IF NOT EXISTS project_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  file_path       TEXT NOT NULL,   -- Supabase Storage path
  file_name       TEXT NOT NULL,   -- Original file name
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_attachments_project_idx ON project_attachments (project_id);

-- 2. Update Project Milestones to add Outreach regions
ALTER TABLE project_milestones 
  ADD COLUMN IF NOT EXISTS assigned_region TEXT;

-- 3. Enable RLS on attachments
ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view project attachments" 
ON public.project_attachments FOR SELECT 
USING (true);

-- 4. Supabase Grants
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_attachments TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_attachments TO service_role;
    GRANT SELECT ON public.project_attachments TO anon;
  END IF;
END $$;