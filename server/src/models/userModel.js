import { query, withTransaction } from "../config/db.js";

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export async function findUserByEmail(emailNormalized) {
  const { rows } = await query(
    `SELECT id, email, email_normalized, password_hash, email_verified_at,
            status, created_at, updated_at, last_login_at
       FROM users
      WHERE email_normalized = $1
      LIMIT 1`,
    [emailNormalized],
  );
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await query(
    `SELECT id, email, email_normalized, password_hash, email_verified_at,
            status, created_at, updated_at, last_login_at
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

export async function getRolesForUser(userId) {
  const { rows } = await query(
    `SELECT r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
      ORDER BY r.name`,
    [userId],
  );
  return rows.map((r) => r.name);
}

export async function getProfileForUser(userId) {
  const { rows } = await query(
    `SELECT user_id, first_name, last_name, display_name, graduation_year,
            biography, profession, organization, district, country_code,
            mentor_opt_in, public_visibility, show_email, show_phone,
            avatar_path, created_at, updated_at
       FROM member_profiles
      WHERE user_id = $1
      LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

/**
 * Register a member atomically:
 *  - insert user
 *  - insert member_profile
 *  - grant 'member' role (plus 'mentor' if mentorOptIn)
 * Runs in a single transaction; any failure rolls everything back.
 */
export async function createMember({
  email,
  passwordHash,
  firstName,
  lastName,
  graduationYear,
  district,
  countryCode,
  mentorOptIn,
}) {
  const emailNormalized = normalizeEmail(email);

  return withTransaction(async (client) => {
    const userRes = await client.query(
      `INSERT INTO users (email, email_normalized, password_hash, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id, email, email_normalized, status, created_at`,
      [email, emailNormalized, passwordHash],
    );
    const user = userRes.rows[0];

    await client.query(
      `INSERT INTO member_profiles
         (user_id, first_name, last_name, graduation_year, district, country_code, mentor_opt_in)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.id,
        firstName,
        lastName,
        graduationYear ?? null,
        district ?? null,
        countryCode ?? null,
        Boolean(mentorOptIn),
      ],
    );

    const roleNames = ["member"];
    if (mentorOptIn) roleNames.push("mentor");

    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE name = ANY($2::text[])`,
      [user.id, roleNames],
    );

    return { user, roles: roleNames };
  });
}

export async function touchLastLogin(userId) {
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
}

export async function updateUserPassword(userId, newPasswordHash) {
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
    newPasswordHash,
    userId,
  ]);
}
