-- Migration 048: Contribution payment proof and rejection audit fields.
-- Payment proof remains optional for historical and external contributions.
-- New member submissions must provide proof through application validation.

ALTER TABLE public.contributions
    ADD COLUMN IF NOT EXISTS payment_proof_path TEXT,
    ADD COLUMN IF NOT EXISTS payment_proof_name TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS rejected_by UUID,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Record which authorized user rejected a contribution.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.contributions'::regclass
          AND conname = 'contributions_rejected_by_fkey'
    ) THEN
        ALTER TABLE public.contributions
            ADD CONSTRAINT contributions_rejected_by_fkey
            FOREIGN KEY (rejected_by)
            REFERENCES public.users(id)
            ON DELETE SET NULL;
    END IF;
END $$;
