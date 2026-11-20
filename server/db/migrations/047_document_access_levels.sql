-- 047_document_access_levels.sql
-- Add document-level access control.
-- Existing and newly uploaded documents default to super-admin-only.

ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS access_level TEXT
    NOT NULL DEFAULT 'super_admin_only';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.documents'::regclass
          AND conname = 'documents_access_level_check'
    ) THEN
        ALTER TABLE public.documents
            ADD CONSTRAINT documents_access_level_check
            CHECK (
                access_level IN (
                    'super_admin_only',
                    'leadership_only',
                    'approved_members'
                )
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS documents_access_level_created_at_idx
    ON public.documents (access_level, created_at DESC);
