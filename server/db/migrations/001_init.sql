-- 001_init.sql
-- Core identity tables: users, roles, user_roles, member_profiles.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL,
  email_normalized  TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'deactivated', 'pending_verification')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at     TIMESTAMPTZ
);

CREATE INDEX users_status_idx     ON users (status);
CREATE INDEX users_created_at_idx ON users (created_at DESC);

CREATE TABLE roles (
  id          SMALLSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE
              CHECK (name IN ('member', 'mentor', 'moderator', 'admin', 'super_admin')),
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    SMALLINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX user_roles_role_id_idx ON user_roles (role_id);

CREATE TABLE member_profiles (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  first_name         TEXT NOT NULL,
  last_name          TEXT NOT NULL,
  display_name       TEXT,
  graduation_year    SMALLINT
                     CHECK (graduation_year IS NULL OR (graduation_year BETWEEN 1950 AND 2100)),

  biography          TEXT CHECK (biography IS NULL OR char_length(biography) <= 2000),
  profession         TEXT,
  organization       TEXT,

  district           TEXT,
  country_code       CHAR(2),

  mentor_opt_in      BOOLEAN NOT NULL DEFAULT FALSE,

  public_visibility  BOOLEAN NOT NULL DEFAULT TRUE,
  show_email         BOOLEAN NOT NULL DEFAULT FALSE,
  show_phone         BOOLEAN NOT NULL DEFAULT FALSE,

  avatar_path        TEXT,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX member_profiles_visibility_idx ON member_profiles (public_visibility);
CREATE INDEX member_profiles_grad_year_idx  ON member_profiles (graduation_year);
CREATE INDEX member_profiles_district_idx   ON member_profiles (district);
CREATE INDEX member_profiles_profession_idx ON member_profiles (profession);
CREATE INDEX member_profiles_mentor_idx     ON member_profiles (mentor_opt_in) WHERE mentor_opt_in = TRUE;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER member_profiles_set_updated_at
  BEFORE UPDATE ON member_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();