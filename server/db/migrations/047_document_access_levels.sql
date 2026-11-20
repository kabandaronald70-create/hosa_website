-- Migration 047: Secure document access levels.
-- Existing and newly uploaded documents default to super-admin-only.

ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS access_level TEXT;

-- Preserve recognized permissions; secure legacy or invalid values.
UPDATE public.documents
SET access_level = 'super_admin_only'
WHERE access_level IS NULL
   OR access_level NOT IN (
       'super_admin_only',
       'leadership_only',
       'approved_members'
   );

-- Enforce the secure default and mandatory access level.
ALTER TABLE public.documents
    ALTER COLUMN access_level SET DEFAULT 'super_admin_only';

ALTER TABLE public.documents
    ALTER COLUMN access_level SET NOT NULL;

-- Enforce the permitted access levels.
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

-- Support access-level filtering and sorting.
CREATE INDEX IF NOT EXISTS documents_access_level_created_at_idx
    ON public.documents (access_level, created_at DESC);
