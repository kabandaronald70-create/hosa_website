-- 006_content_columns.sql
-- Adds columns that the existing public/data/*.json files already contain.

-- -------------------------- events --------------------------
ALTER TABLE events
  ADD COLUMN external_ref  TEXT UNIQUE,        -- 'e001'
  ADD COLUMN district      TEXT,
  ADD COLUMN latitude      NUMERIC(9,6),
  ADD COLUMN longitude     NUMERIC(9,6),
  ADD COLUMN event_type    TEXT;               -- 'AGM', 'Reunion', etc.

CREATE INDEX events_district_idx ON events (district) WHERE district IS NOT NULL;

-- ---------------------- opportunities -----------------------
ALTER TABLE opportunities
  ADD COLUMN external_ref  TEXT UNIQUE,        -- 'o001'
  ADD COLUMN employer      TEXT,               -- their name for organization
  ADD COLUMN type_label    TEXT,               -- 'Graduate Program', 'Internship', 'Scholarship'
  ADD COLUMN posted_by_ref TEXT;               -- 'm006' → member seed_ref

CREATE INDEX opportunities_type_label_idx ON opportunities (type_label);

-- ------------------------- stories --------------------------
ALTER TABLE stories
  ADD COLUMN external_ref  TEXT UNIQUE,        -- 's001'
  ADD COLUMN author_name   TEXT,               -- 'Moses Wasswa'
  ADD COLUMN author_ref    TEXT,               -- 'm008' → member seed_ref
  ADD COLUMN class_year    SMALLINT,
  ADD COLUMN category      TEXT,
  ADD COLUMN story_date    DATE;               -- their 'date' field

CREATE INDEX stories_category_idx ON stories (category);