-- 003_sessions.sql
-- Session table for connect-pg-simple. Uses the standard schema that
-- connect-pg-simple expects. Read-only by the app except for the store.

CREATE TABLE session (
  sid    VARCHAR      NOT NULL COLLATE "default",
  sess   JSON         NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_session_expire ON session (expire);