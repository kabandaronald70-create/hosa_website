-- 031_expense_approvals.sql
-- Two-tier expense approval and payment tracking

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS chairperson_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chairperson_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Update status check constraint
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_status_check 
CHECK (status IN ('pending', 'executive_approved', 'approved', 'paid', 'rejected'));

-- Supabase Grants
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO service_role;
  END IF;
END $$;