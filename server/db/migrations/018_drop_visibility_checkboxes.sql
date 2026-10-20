-- 018_drop_visibility_checkboxes.sql
-- The 3-tier privacy columns added in 016 (email_privacy / phone_privacy /
-- district_privacy) replaced the old boolean show_email / show_phone flags.

ALTER TABLE member_profiles
  DROP COLUMN IF EXISTS show_email,
  DROP COLUMN IF EXISTS show_phone;
