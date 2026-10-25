-- 034_registration_fields.sql

ALTER TABLE member_profiles 
  ADD COLUMN IF NOT EXISTS other_name TEXT,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT;

-- 'phone' might already exist from an earlier migration, but let's ensure it's there
ALTER TABLE member_profiles 
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Supabase Grants
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_profiles TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_profiles TO service_role;
    GRANT SELECT ON public.member_profiles TO anon;
  END IF;
END $$;