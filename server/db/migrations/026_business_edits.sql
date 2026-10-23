-- 026_business_edits.sql
-- Add a column to track when a business was last edited
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add the update trigger (if it doesn't exist)
DROP TRIGGER IF EXISTS businesses_set_updated_at ON businesses;
CREATE TRIGGER businesses_set_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Supabase Grants
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO service_role;
    GRANT SELECT ON public.businesses TO anon;
  END IF;
END $$;