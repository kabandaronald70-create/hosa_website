-- 050_expense_approval_history.sql
-- Expense approval audit trail and rejection metadata.

-- ---------------------------------------------------------------------------
-- 1. Rejection audit metadata
-- ---------------------------------------------------------------------------

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS rejected_by UUID
    REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2. Immutable expense approval history
-- ---------------------------------------------------------------------------

CREATE TABLE public.expense_approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  expense_id UUID NOT NULL
    REFERENCES public.expenses(id) ON DELETE CASCADE,

  actor_user_id UUID
    REFERENCES public.users(id) ON DELETE SET NULL,

  actor_role TEXT NOT NULL
    CHECK (actor_role IN (
      'treasurer',
      'chairperson',
      'super_admin',
      'legacy'
    )),

  action TEXT NOT NULL
    CHECK (action IN (
      'submitted',
      'chairperson_approved',
      'super_admin_approved',
      'rejected',
      'paid'
    )),

  comments TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX expense_approval_history_expense_idx
  ON public.expense_approval_history (expense_id, created_at, id);

CREATE INDEX expense_approval_history_actor_idx
  ON public.expense_approval_history (actor_user_id, created_at DESC);

CREATE INDEX expense_approval_history_action_idx
  ON public.expense_approval_history (action, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Preserve reconstructable historical events
-- ---------------------------------------------------------------------------

-- Submission records can be reconstructed from the original requester
-- and expense creation timestamp.
INSERT INTO public.expense_approval_history (
  expense_id,
  actor_user_id,
  actor_role,
  action,
  comments,
  created_at
)
SELECT
  id,
  requested_by,
  'legacy',
  'submitted',
  'Historical submission reconstructed from the original expense record.',
  created_at
FROM public.expenses
WHERE requested_by IS NOT NULL;

-- Historical Chairperson approvals.
INSERT INTO public.expense_approval_history (
  expense_id,
  actor_user_id,
  actor_role,
  action,
  comments,
  created_at
)
SELECT
  id,
  chairperson_approved_by,
  'chairperson',
  'chairperson_approved',
  'Historical Chairperson approval reconstructed from the original expense record.',
  chairperson_approved_at
FROM public.expenses
WHERE chairperson_approved_by IS NOT NULL
  AND chairperson_approved_at IS NOT NULL;

-- Historical final approvals.
INSERT INTO public.expense_approval_history (
  expense_id,
  actor_user_id,
  actor_role,
  action,
  comments,
  created_at
)
SELECT
  id,
  approved_by,
  'super_admin',
  'super_admin_approved',
  'Historical final approval reconstructed from the original expense record.',
  approved_at
FROM public.expenses
WHERE approved_by IS NOT NULL
  AND approved_at IS NOT NULL;

-- Historical payments are recorded as legacy because the old schema
-- does not establish whether the payer was Treasurer or Super Admin.
INSERT INTO public.expense_approval_history (
  expense_id,
  actor_user_id,
  actor_role,
  action,
  comments,
  created_at
)
SELECT
  id,
  paid_by,
  'legacy',
  'paid',
  'Historical payment reconstructed; original payer role is not recorded.',
  paid_at
FROM public.expenses
WHERE paid_by IS NOT NULL
  AND paid_at IS NOT NULL;

-- Historical rejections are deliberately not reconstructed because the
-- previous schema did not reliably record the rejecting user or timestamp.

-- ---------------------------------------------------------------------------
-- 5. Row-level security and restricted database access
-- ---------------------------------------------------------------------------

ALTER TABLE public.expense_approval_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.expense_approval_history FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'anon'
  ) THEN
    REVOKE ALL ON public.expense_approval_history FROM anon;
  END IF;

  IF EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'authenticated'
  ) THEN
    REVOKE ALL ON public.expense_approval_history FROM authenticated;
  END IF;

  IF EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'service_role'
  ) THEN
    GRANT SELECT, INSERT
      ON public.expense_approval_history TO service_role;
  END IF;
END $$;
