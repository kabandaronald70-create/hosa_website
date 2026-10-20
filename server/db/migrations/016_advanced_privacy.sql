-- 016_advanced_privacy.sql

-- 1. Add 3-tier privacy columns (Public, Members, Private)
ALTER TABLE member_profiles
  ADD COLUMN email_privacy TEXT NOT NULL DEFAULT 'private' CHECK (email_privacy IN ('public', 'members', 'private')),
  ADD COLUMN phone_privacy TEXT NOT NULL DEFAULT 'private' CHECK (phone_privacy IN ('public', 'members', 'private')),
  ADD COLUMN district_privacy TEXT NOT NULL DEFAULT 'public' CHECK (district_privacy IN ('public', 'members', 'private'));

-- 2. Add membership approval tracking
ALTER TABLE users
  ADD COLUMN membership_approved_at TIMESTAMPTZ,
  ADD COLUMN membership_approved_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3. Set existing active users to approved so they aren't locked out
UPDATE users SET membership_approved_at = now() WHERE status = 'active';