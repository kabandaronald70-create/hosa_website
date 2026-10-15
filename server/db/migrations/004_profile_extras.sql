-- 004_profile_extras.sql
-- Extends member_profiles with the fields the profile edit form needs.
-- All additions are nullable so existing rows remain valid.

ALTER TABLE member_profiles
  ADD COLUMN phone                   TEXT CHECK (phone IS NULL OR char_length(phone) <= 40),
  ADD COLUMN preferred_contact       TEXT
                                     CHECK (preferred_contact IS NULL
                                            OR preferred_contact IN ('email', 'phone', 'none')),
  ADD COLUMN skills                  TEXT CHECK (skills IS NULL OR char_length(skills) <= 500),
  ADD COLUMN interests               TEXT CHECK (interests IS NULL OR char_length(interests) <= 500),
  ADD COLUMN career_history          TEXT CHECK (career_history IS NULL OR char_length(career_history) <= 4000);

-- Index for "find mentors" is already covered by member_profiles_mentor_idx.
-- Add a nullable "verified" flag that Phase 4 (admin) will manage.
ALTER TABLE member_profiles
  ADD COLUMN verified_at             TIMESTAMPTZ;

CREATE INDEX member_profiles_verified_idx ON member_profiles (verified_at)
  WHERE verified_at IS NOT NULL;