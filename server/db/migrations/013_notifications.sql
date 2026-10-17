-- 013_notifications.sql
-- In-app notifications for moderation decisions and mentorship events.

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL
              CHECK (type IN (
                'story.approved', 'story.rejected',
                'opportunity.approved', 'opportunity.rejected',
                'mentorship.accepted', 'mentorship.declined',
                'membership.verified'
              )),
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,                 -- relative URL to the target page
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX notifications_user_all_idx
  ON notifications (user_id, created_at DESC);