-- 049_project_proposal_approval_workflow.sql
-- Multi-stage approval workflow for Projects Manager and Regional Outreach proposals.


-- ---------------------------------------------------------------------------
-- 1. Project proposal and approval tracking
-- ---------------------------------------------------------------------------

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS proposal_source TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_stage TEXT NOT NULL DEFAULT 'chairperson',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Preserve historical projects without inventing approval history.
UPDATE projects
SET
  proposal_source = 'legacy',
  approval_status = CASE
    WHEN status IN ('approved', 'in_progress', 'completed', 'cancelled')
      THEN 'approved'
    ELSE 'pending'
  END,
  approval_stage = CASE
    WHEN status IN ('approved', 'in_progress', 'completed', 'cancelled')
      THEN 'completed'
    ELSE 'chairperson'
  END
WHERE proposal_source = 'legacy';

-- ---------------------------------------------------------------------------
-- 2. Constraints
-- ---------------------------------------------------------------------------

ALTER TABLE projects
  ADD CONSTRAINT projects_proposal_source_check
    CHECK (proposal_source IN (
      'projects_manager',
      'regional_outreach',
      'legacy'
    )),
  ADD CONSTRAINT projects_approval_status_check
    CHECK (approval_status IN (
      'pending',
      'approved',
      'rejected'
    )),
  ADD CONSTRAINT projects_approval_stage_check
    CHECK (approval_stage IN (
      'projects_manager',
      'chairperson',
      'super_admin',
      'completed',
      'rejected'
    )),
  ADD CONSTRAINT projects_rejection_metadata_check
    CHECK (
      (approval_status = 'rejected'
        AND approval_stage = 'rejected'
        AND rejection_reason IS NOT NULL
        AND rejected_at IS NOT NULL)
      OR
      (approval_status <> 'rejected'
        AND rejection_reason IS NULL
        AND rejected_by IS NULL
        AND rejected_at IS NULL)
    );

-- ---------------------------------------------------------------------------
-- 3. Approval history
-- ---------------------------------------------------------------------------

CREATE TABLE project_approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL
    REFERENCES projects(id) ON DELETE CASCADE,

  actor_user_id UUID
    REFERENCES users(id) ON DELETE SET NULL,

  actor_role TEXT NOT NULL
    CHECK (actor_role IN (
      'projects_manager',
      'chairperson',
      'super_admin'
    )),

  decision TEXT NOT NULL
    CHECK (decision IN ('approved', 'rejected')),

  comments TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX project_approval_history_project_idx
  ON project_approval_history (project_id, created_at DESC);

CREATE INDEX projects_approval_queue_idx
  ON projects (approval_status, approval_stage, created_at DESC);

CREATE INDEX projects_proposal_source_idx
  ON projects (proposal_source);

-- ---------------------------------------------------------------------------
-- 4. Row-level security and service-role access
-- ---------------------------------------------------------------------------

ALTER TABLE public.project_approval_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'service_role'
  ) THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON public.project_approval_history TO service_role;
  END IF;
END $$;
