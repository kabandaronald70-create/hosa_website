-- ============================================================
-- 046: Complete HOSA member registration data
--
-- Adds:
-- 1. Additional contact and professional information.
-- 2. Business ownership information (not public listings).
-- 3. Optional member participation preferences.
-- 4. Structured member interests.
-- 5. Auditable registration consent and declaration records.
--
-- Historical records retain unknown values as NULL.
-- No email verification is introduced.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Additional contact information
-- ------------------------------------------------------------

ALTER TABLE member_profiles
ADD COLUMN town_city TEXT,
ADD COLUMN whatsapp_phone TEXT;

ALTER TABLE member_profiles
ADD CONSTRAINT member_profiles_town_city_length_check
CHECK (
    town_city IS NULL OR LENGTH(town_city) <= 120
);

ALTER TABLE member_profiles
ADD CONSTRAINT member_profiles_whatsapp_phone_length_check
CHECK (
    whatsapp_phone IS NULL OR LENGTH(whatsapp_phone) <= 40
);


-- ------------------------------------------------------------
-- 2. Professional information
--
-- profession remains the occupation field.
-- organization remains the employer/organization field.
-- ------------------------------------------------------------

ALTER TABLE member_profiles
ADD COLUMN employment_status TEXT,
ADD COLUMN highest_education TEXT,
ADD COLUMN specialization TEXT;

ALTER TABLE member_profiles
ADD CONSTRAINT member_profiles_employment_status_check
CHECK (
    employment_status IS NULL
    OR employment_status IN (
        'employed',
        'self_employed',
        'unemployed',
        'student',
        'retired',
        'other'
    )
);

ALTER TABLE member_profiles
ADD CONSTRAINT member_profiles_highest_education_check
CHECK (
    highest_education IS NULL
    OR highest_education IN (
        'primary',
        'secondary',
        'certificate',
        'diploma',
        'bachelors',
        'postgraduate_diploma',
        'masters',
        'doctorate',
        'other'
    )
);

ALTER TABLE member_profiles
ADD CONSTRAINT member_profiles_specialization_length_check
CHECK (
    specialization IS NULL OR LENGTH(specialization) <= 160
);


-- ------------------------------------------------------------
-- 3. Business ownership information
--
-- These fields describe the member's business ownership.
-- They do NOT create records in the public businesses table.
--
-- Existing ownership status remains unknown (NULL).
-- ------------------------------------------------------------

ALTER TABLE member_profiles
ADD COLUMN business_owner BOOLEAN,
ADD COLUMN business_name TEXT,
ADD COLUMN business_category TEXT,
ADD COLUMN business_description TEXT,
ADD COLUMN business_website TEXT;

ALTER TABLE member_profiles
ADD CONSTRAINT member_profiles_business_name_length_check
CHECK (
    business_name IS NULL OR LENGTH(business_name) <= 160
);

ALTER TABLE member_profiles
ADD CONSTRAINT member_profiles_business_category_length_check
CHECK (
    business_category IS NULL OR LENGTH(business_category) <= 100
);

ALTER TABLE member_profiles
ADD CONSTRAINT member_profiles_business_description_length_check
CHECK (
    business_description IS NULL
    OR LENGTH(business_description) <= 1000
);

ALTER TABLE member_profiles
ADD CONSTRAINT member_profiles_business_website_length_check
CHECK (
    business_website IS NULL OR LENGTH(business_website) <= 255
);

ALTER TABLE member_profiles
ADD CONSTRAINT member_profiles_business_ownership_check
CHECK (
    (
        business_owner IS TRUE
        AND NULLIF(BTRIM(business_name), '') IS NOT NULL
        AND NULLIF(BTRIM(business_category), '') IS NOT NULL
    )
    OR
    (
        business_owner IS FALSE
        AND business_name IS NULL
        AND business_category IS NULL
        AND business_description IS NULL
        AND business_website IS NULL
    )
    OR
    (
        business_owner IS NULL
        AND business_name IS NULL
        AND business_category IS NULL
        AND business_description IS NULL
        AND business_website IS NULL
    )
);


-- ------------------------------------------------------------
-- 4. Optional participation preferences
--
-- Separate from the primary registration interests.
-- Existing records remain NULL where preferences are unknown.
-- ------------------------------------------------------------

ALTER TABLE member_profiles
ADD COLUMN seeking_mentorship BOOLEAN,
ADD COLUMN volunteer_opt_in BOOLEAN,
ADD COLUMN school_project_support BOOLEAN;


-- ------------------------------------------------------------
-- 5. Structured member interests
--
-- Members can select multiple interests.
-- At least one will be required by application validation.
-- ------------------------------------------------------------

CREATE TABLE member_interests (
    user_id UUID NOT NULL
        REFERENCES member_profiles(user_id)
        ON DELETE CASCADE,

    interest TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT member_interests_pkey
        PRIMARY KEY (user_id, interest),

    CONSTRAINT member_interests_allowed_value_check
        CHECK (
            interest IN (
                'mentorship',
                'networking',
                'career_development',
                'business_opportunities',
                'sports_recreation',
                'community_service',
                'school_development',
                'fundraising',
                'leadership',
                'events'
            )
        )
);

CREATE INDEX idx_member_interests_interest
    ON member_interests (interest);


-- ------------------------------------------------------------
-- 6. Registration acceptance records
--
-- One record per member.
-- A record documents acceptance of the applicable policy
-- versions and registration declaration.
--
-- The application must supply version identifiers and
-- acceptance timestamps during registration.
-- ------------------------------------------------------------

CREATE TABLE registration_acceptances (
    user_id UUID PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,

    terms_version TEXT NOT NULL,
    terms_accepted_at TIMESTAMPTZ NOT NULL,

    privacy_version TEXT NOT NULL,
    privacy_accepted_at TIMESTAMPTZ NOT NULL,

    declaration_version TEXT NOT NULL,
    declaration_accepted_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT registration_acceptances_terms_version_check
        CHECK (
            LENGTH(BTRIM(terms_version)) BETWEEN 1 AND 50
        ),

    CONSTRAINT registration_acceptances_privacy_version_check
        CHECK (
            LENGTH(BTRIM(privacy_version)) BETWEEN 1 AND 50
        ),

    CONSTRAINT registration_acceptances_declaration_version_check
        CHECK (
            LENGTH(BTRIM(declaration_version)) BETWEEN 1 AND 50
        )
);

COMMENT ON TABLE registration_acceptances IS
'Auditable record of terms, privacy policy and member declaration acceptance during registration.';

COMMENT ON TABLE member_interests IS
'Structured HOSA member interests selected during registration.';

COMMENT ON COLUMN member_profiles.business_owner IS
'Whether the member declared business ownership during registration. NULL represents unknown historical information.';

COMMENT ON COLUMN member_profiles.public_visibility IS
'Whether the member explicitly opted into public directory visibility. New registrations default to private.';

