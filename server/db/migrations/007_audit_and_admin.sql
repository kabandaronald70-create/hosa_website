-- 007_audit_and_admin.sql
-- Audit log for admin/moderator actions. Never stores secrets.

CREATE TABLE audit_logs (
  id             BIGSERIAL PRIMARY KEY,
  actor_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email    TEXT,             -- snapshot, survives user deletion
  action         TEXT NOT NULL,    -- e.g. 'member.suspend'
  target_type    TEXT,             -- e.g. 'user', 'story', 'event'
  target_id      TEXT,             -- stringified UUID or ref
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address     TEXT,
  user_agent     TEXT,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_occurred_idx     ON audit_logs (occurred_at DESC);
CREATE INDEX audit_logs_actor_idx        ON audit_logs (actor_user_id, occurred_at DESC);
CREATE INDEX audit_logs_action_idx       ON audit_logs (action, occurred_at DESC);
CREATE INDEX audit_logs_target_idx       ON audit_logs (target_type, target_id);