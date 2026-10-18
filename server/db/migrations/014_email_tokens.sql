-- 014_email_tokens.sql
CREATE TABLE email_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('verification', 'reset')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX email_tokens_hash_idx ON email_tokens (token_hash);
CREATE INDEX email_tokens_user_idx ON email_tokens (user_id);