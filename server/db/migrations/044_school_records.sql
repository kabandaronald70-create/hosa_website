-- Migration 044: Dedicated HOSA school records
-- One school record per member profile.
-- Existing graduation years are preserved and copied into completion_year.
-- Unknown historical information is intentionally left NULL.

CREATE TABLE school_records (
    user_id UUID PRIMARY KEY
        REFERENCES member_profiles(user_id)
        ON DELETE CASCADE,

    admission_year SMALLINT,
    completion_year SMALLINT,

    last_class_attended TEXT,
    last_class_explanation TEXT,

    school_house TEXT,
    school_house_other TEXT,

    examination_level TEXT,
    examination_level_other TEXT,
    examination_year SMALLINT,
    examination_index_number TEXT,

    former_teacher TEXT,

    school_status TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT school_records_admission_year_check
        CHECK (
            admission_year IS NULL
            OR admission_year BETWEEN 1950 AND 2100
        ),

    CONSTRAINT school_records_completion_year_check
        CHECK (
            completion_year IS NULL
            OR completion_year BETWEEN 1950 AND 2100
        ),

    CONSTRAINT school_records_examination_year_check
        CHECK (
            examination_year IS NULL
            OR examination_year BETWEEN 1950 AND 2100
        ),

    CONSTRAINT school_records_year_order_check
        CHECK (
            admission_year IS NULL
            OR completion_year IS NULL
            OR admission_year <= completion_year
        ),

    CONSTRAINT school_records_last_class_check
        CHECK (
            last_class_attended IS NULL
            OR last_class_attended IN (
                'S1', 'S2', 'S3', 'S4', 'S5', 'S6',
                'other', 'not_sure'
            )
        ),

    CONSTRAINT school_records_last_class_explanation_check
        CHECK (
            (
                last_class_attended IN ('other', 'not_sure')
                AND NULLIF(BTRIM(last_class_explanation), '') IS NOT NULL
            )
            OR
            (
                last_class_attended NOT IN ('other', 'not_sure')
                AND last_class_explanation IS NULL
            )
            OR last_class_attended IS NULL
        ),

    CONSTRAINT school_records_house_check
        CHECK (
            school_house IS NULL
            OR school_house IN (
                'Nyerere',
                'Nkrumah',
                'Muteesa',
                'Lumumba',
                'Mandela',
                'Other'
            )
        ),

    CONSTRAINT school_records_house_other_check
        CHECK (
            (
                school_house = 'Other'
                AND NULLIF(BTRIM(school_house_other), '') IS NOT NULL
            )
            OR
            (
                school_house IS DISTINCT FROM 'Other'
                AND school_house_other IS NULL
            )
        ),

    CONSTRAINT school_records_examination_level_check
        CHECK (
            examination_level IS NULL
            OR examination_level IN (
                'UCE',
                'UACE',
                'other',
                'not_applicable'
            )
        ),

    CONSTRAINT school_records_examination_other_check
        CHECK (
            (
                examination_level = 'other'
                AND NULLIF(BTRIM(examination_level_other), '') IS NOT NULL
            )
            OR
            (
                examination_level IS DISTINCT FROM 'other'
                AND examination_level_other IS NULL
            )
        ),

    CONSTRAINT school_records_index_number_length_check
        CHECK (
            examination_index_number IS NULL
            OR LENGTH(examination_index_number) <= 60
        ),

    CONSTRAINT school_records_former_teacher_length_check
        CHECK (
            former_teacher IS NULL
            OR LENGTH(former_teacher) <= 120
        ),

    CONSTRAINT school_records_class_explanation_length_check
        CHECK (
            last_class_explanation IS NULL
            OR LENGTH(last_class_explanation) <= 300
        ),

    CONSTRAINT school_records_house_other_length_check
        CHECK (
            school_house_other IS NULL
            OR LENGTH(school_house_other) <= 100
        ),

    CONSTRAINT school_records_exam_other_length_check
        CHECK (
            examination_level_other IS NULL
            OR LENGTH(examination_level_other) <= 200
        ),

    CONSTRAINT school_records_status_check
        CHECK (
            school_status IS NULL
            OR school_status IN ('current_student', 'old_student')
        ),

    CONSTRAINT school_records_known_status_requirements_check
        CHECK (
            school_status IS NULL
            OR (
                admission_year IS NOT NULL
                AND last_class_attended IS NOT NULL
                AND (
                    school_status <> 'old_student'
                    OR completion_year IS NOT NULL
                )
            )
        )
);

COMMENT ON TABLE school_records IS
'School history for HOSA members. One record per member profile.';

COMMENT ON COLUMN school_records.completion_year IS
'Authoritative school completion year. Mirrored to member_profiles.graduation_year for compatibility.';

COMMENT ON COLUMN school_records.school_status IS
'Current student or old student. NULL is permitted for legacy records with unknown status.';

COMMENT ON COLUMN school_records.admission_year IS
'Year the member joined Highway Secondary School. Historical unknown values remain NULL.';

-- Preserve existing graduation years without inventing historical information.
INSERT INTO school_records (
    user_id,
    completion_year
)
SELECT
    user_id,
    graduation_year
FROM member_profiles
ON CONFLICT (user_id) DO NOTHING;

-- Index for administrative filtering by school status.
CREATE INDEX idx_school_records_school_status
    ON school_records (school_status)
    WHERE school_status IS NOT NULL;
