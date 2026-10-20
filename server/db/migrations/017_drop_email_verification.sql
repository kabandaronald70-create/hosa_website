-- 017_drop_email_verification.sql
-- Email verification and password-reset emails have been removed from the app.
-- Drop the now-unused verification/reset token table and the email_verified_at flag.

DROP TABLE IF EXISTS email_tokens;

ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at;
