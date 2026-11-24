-- 1. Add expense submission and approval workflow metadata.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS submitted_office TEXT,
  ADD COLUMN IF NOT EXISTS submitted_role TEXT,
  ADD COLUMN IF NOT EXISTS approval_stage TEXT;

-- 2. Preserve historical records without guessing their original offices.
UPDATE public.expenses
SET
  submitted_office = COALESCE(NULLIF(TRIM(submitted_office), ''), 'Legacy'),
  submitted_role = COALESCE(NULLIF(LOWER(TRIM(submitted_role)), ''), 'legacy'),
  approval_stage = CASE
    WHEN status = 'paid' THEN 'completed'
    WHEN status = 'rejected' THEN 'rejected'
    WHEN status = 'approved' THEN 'payment'
    WHEN status = 'executive_approved' THEN 'super_admin'
    ELSE 'legacy'
  END
WHERE
  submitted_office IS NULL
  OR submitted_role IS NULL
  OR approval_stage IS NULL;

-- 3. Set defaults and enforce required metadata.
ALTER TABLE public.expenses
  ALTER COLUMN submitted_office SET DEFAULT 'Legacy',
  ALTER COLUMN submitted_office SET NOT NULL,
  ALTER COLUMN submitted_role SET DEFAULT 'legacy',
  ALTER COLUMN submitted_role SET NOT NULL,
  ALTER COLUMN approval_stage SET DEFAULT 'legacy',
  ALTER COLUMN approval_stage SET NOT NULL;

-- 4. Restrict workflow stages and submitting roles.
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_approval_stage_check
  CHECK (
    approval_stage IN (
      'projects_manager',
      'treasurer',
      'chairperson',
      'super_admin',
      'payment',
      'completed',
      'rejected',
      'legacy'
    )
  );

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_submitted_role_check
  CHECK (
    submitted_role IN (
      'publicity',
      'general_secretary',
      'projects_manager',
      'regional_outreach_officer',
      'treasurer',
      'legacy'
    )
  );

-- 5. Expand history actor roles.
ALTER TABLE public.expense_approval_history
  DROP CONSTRAINT expense_approval_history_actor_role_check;

ALTER TABLE public.expense_approval_history
  ADD CONSTRAINT expense_approval_history_actor_role_check
  CHECK (
    actor_role IN (
      'publicity',
      'general_secretary',
      'projects_manager',
      'regional_outreach_officer',
      'treasurer',
      'chairperson',
      'super_admin',
      'legacy'
    )
  );

-- 6. Expand history actions for the new approval sequence.
ALTER TABLE public.expense_approval_history
  DROP CONSTRAINT expense_approval_history_action_check;

ALTER TABLE public.expense_approval_history
  ADD CONSTRAINT expense_approval_history_action_check
  CHECK (
    action IN (
      'submitted',
      'projects_manager_approved',
      'treasurer_approved',
      'chairperson_approved',
      'super_admin_approved',
      'rejected',
      'paid'
    )
  );

-- 7. Add indexes for workflow queries.
CREATE INDEX IF NOT EXISTS idx_expenses_approval_stage
  ON public.expenses (approval_stage, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_submitted_role
  ON public.expenses (submitted_role, created_at DESC);
