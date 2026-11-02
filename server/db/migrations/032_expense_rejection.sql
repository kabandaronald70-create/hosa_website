-- 032_expense_rejection.sql
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Supabase Grants
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO service_role;
  END IF;
END $$;