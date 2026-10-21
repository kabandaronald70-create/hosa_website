-- 019_fix_privacy_and_status.sql
-- Ensures all Phase 4A privacy columns and the pending_approval status exist.

ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS email_privacy TEXT NOT NULL DEFAULT 'private' CHECK (email_privacy IN ('public', 'members', 'private'));
ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS phone_privacy TEXT NOT NULL DEFAULT 'private' CHECK (phone_privacy IN ('public', 'members', 'private'));
ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS district_privacy TEXT NOT NULL DEFAULT 'public' CHECK (district_privacy IN ('public', 'members', 'private'));

ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS skills TEXT;
ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS career_history TEXT;
ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS preferred_contact TEXT;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'deactivated', 'pending_verification', 'pending_approval'));