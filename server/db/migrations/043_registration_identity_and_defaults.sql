-- ============================================================
-- 043: Registration identity and privacy defaults
--
-- 1. Add usernames to user accounts.
-- 2. Generate usernames for existing accounts.
-- 3. Enforce case-insensitive username uniqueness.
-- 4. Default new profiles to private directory visibility.
-- 5. Restrict HOSA member regions to four official values.
-- 6. Support WhatsApp as a preferred contact method.
--
-- Existing account identities and profile visibility choices
-- are preserved.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add username column
-- ------------------------------------------------------------

ALTER TABLE users
ADD COLUMN username TEXT;

-- ------------------------------------------------------------
-- 2. Generate usernames for existing accounts
--
-- Format: member_ followed by 16 hexadecimal characters.
-- Example: member_a1b2c3d4e5f67890
-- ------------------------------------------------------------

UPDATE users
SET username = (
    'member_' ||
    SUBSTRING(REPLACE(id::TEXT, '-', '') FROM 1 FOR 16)
)
WHERE username IS NULL;

-- ------------------------------------------------------------
-- 3. Enforce username requirements
-- ------------------------------------------------------------

ALTER TABLE users
ALTER COLUMN username SET NOT NULL;

ALTER TABLE users
ADD CONSTRAINT users_username_format_check
CHECK (
    username ~ '^[A-Za-z0-9._-]{3,30}$'
);

CREATE UNIQUE INDEX users_username_lower_key
ON users (LOWER(username));

COMMENT ON COLUMN users.username IS
'Unique login username. Existing accounts receive system-generated usernames.';

-- ------------------------------------------------------------
-- 4. Make new member profiles private by default
--
-- Do not update existing records.
-- ------------------------------------------------------------

ALTER TABLE member_profiles
ALTER COLUMN public_visibility SET DEFAULT FALSE;

-- ------------------------------------------------------------
-- 5. Restrict HOSA member regions
--
-- Existing NULL values remain valid.
-- ------------------------------------------------------------

ALTER TABLE member_profiles
ADD CONSTRAINT member_profiles_hosa_region_check
CHECK (
    region IS NULL
    OR region IN (
        'Eastern',
        'Central',
        'Western',
        'Northern'
    )
);

-- ------------------------------------------------------------
-- 6. Extend preferred contact options to include WhatsApp
-- ------------------------------------------------------------

DO $$
DECLARE
    existing_constraint RECORD;
BEGIN
    FOR existing_constraint IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.member_profiles'::REGCLASS
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%preferred_contact%'
    LOOP
        EXECUTE FORMAT(
            'ALTER TABLE member_profiles DROP CONSTRAINT %I',
            existing_constraint.conname
        );
    END LOOP;
END $$;

ALTER TABLE member_profiles
ADD CONSTRAINT member_profiles_preferred_contact_check
CHECK (
    preferred_contact IS NULL
    OR preferred_contact IN (
        'email',
        'phone',
        'whatsapp',
        'none'
    )
);