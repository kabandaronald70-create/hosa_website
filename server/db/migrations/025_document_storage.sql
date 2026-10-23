-- 025_document_storage.sql
-- Prepare the documents table for Supabase Storage integration

ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Relax constraints so uploads don't fail if optional fields are blank
ALTER TABLE documents ALTER COLUMN file_name DROP NOT NULL;
ALTER TABLE documents ALTER COLUMN description DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- Supabase Data API grants (required for new tables after Oct 30, 2026)
-- Safe to run multiple times. Skips if roles don't exist locally.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO service_role;
    GRANT SELECT ON public.documents TO anon;
  END IF;
END $$;