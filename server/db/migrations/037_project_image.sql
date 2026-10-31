-- 037_project_image.sql

ALTER TABLE projects ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Supabase Grants & RLS (in case they were missed)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO service_role;
    GRANT SELECT ON public.projects TO anon;
  END IF;
END $$;