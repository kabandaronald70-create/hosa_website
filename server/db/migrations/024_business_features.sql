-- 024_business_features.sql

ALTER TABLE businesses 
  ADD COLUMN IF NOT EXISTS logo_path TEXT,
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

-- Supabase Data API grants are not needed for ALTER TABLE, but we'll record the migration.