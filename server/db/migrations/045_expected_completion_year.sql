-- Migration 045: Expected school completion year
-- Keep expected completion separate from actual completion.
-- Legacy records with unknown school status remain unchanged.

ALTER TABLE school_records
    ADD COLUMN expected_completion_year SMALLINT;

ALTER TABLE school_records
    ADD CONSTRAINT school_records_expected_completion_year_check
    CHECK (
        expected_completion_year IS NULL
        OR expected_completion_year BETWEEN 1950 AND 2100
    );

ALTER TABLE school_records
    ADD CONSTRAINT school_records_expected_year_order_check
    CHECK (
        admission_year IS NULL
        OR expected_completion_year IS NULL
        OR admission_year <= expected_completion_year
    );

ALTER TABLE school_records
    DROP CONSTRAINT school_records_known_status_requirements_check;

ALTER TABLE school_records
    ADD CONSTRAINT school_records_known_status_requirements_check
    CHECK (
        school_status IS NULL
        OR (
            admission_year IS NOT NULL
            AND last_class_attended IS NOT NULL
            AND (
                (
                    school_status = 'current_student'
                    AND expected_completion_year IS NOT NULL
                    AND completion_year IS NULL
                )
                OR
                (
                    school_status = 'old_student'
                    AND completion_year IS NOT NULL
                    AND expected_completion_year IS NULL
                )
            )
        )
    );

COMMENT ON COLUMN school_records.expected_completion_year IS
'Expected year of school completion for a current student. This is not an actual completion or graduation year.';