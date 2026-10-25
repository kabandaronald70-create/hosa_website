-- 029_leadership_details.sql

ALTER TABLE leadership_roles 
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Supabase Grants
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.leadership_roles TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.leadership_roles TO service_role;
    GRANT SELECT ON public.leadership_roles TO anon;
  END IF;
END $$;