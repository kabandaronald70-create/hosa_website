import { query } from "../config/db.js";

export async function getProfileByUserId(userId) {
  const { rows } = await query(
    `SELECT user_id, first_name, last_name, display_name, graduation_year,
            biography, profession, organization, district, country_code,
            phone, preferred_contact, skills, interests, career_history,
            mentor_opt_in, public_visibility, show_email, show_phone,
            avatar_path, verified_at, created_at, updated_at
       FROM member_profiles
      WHERE user_id = $1
      LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

/**
 * Update a member's profile. Ownership is enforced by user_id = $1.
 * The caller supplies only the fields it wants to change.
 */
export async function updateProfile(userId, fields) {
  const allowed = [
    "first_name",
    "last_name",
    "display_name",
    "graduation_year",
    "biography",
    "profession",
    "organization",
    "district",
    "country_code",
    "phone",
    "preferred_contact",
    "skills",
    "interests",
    "career_history",
    "mentor_opt_in",
    "public_visibility",
    "show_email",
    "show_phone",
  ];

  const sets = [];
  const values = [];
  let i = 1;
  for (const key of allowed) {
    if (key in fields) {
      sets.push(`${key} = $${i++}`);
      values.push(fields[key]);
    }
  }

  if (sets.length === 0) return getProfileByUserId(userId);

  values.push(userId);
  const { rows } = await query(
    `UPDATE member_profiles
        SET ${sets.join(", ")}
      WHERE user_id = $${i}
      RETURNING *`,
    values,
  );
  return rows[0] || null;
}

/**
 * Return a 0–100 profile completion score with a short label per missing field.
 * This lives in the model so both the dashboard and admin can use it.
 */
export function profileCompletion(profile) {
  const checks = [
    ["first_name", profile?.first_name],
    ["last_name", profile?.last_name],
    ["graduation_year", profile?.graduation_year],
    ["biography", profile?.biography && profile.biography.length >= 40],
    ["profession", profile?.profession],
    ["district", profile?.district],
    ["country_code", profile?.country_code],
  ];
  const filled = checks.filter(([, v]) => Boolean(v)).length;
  const pct = Math.round((filled / checks.length) * 100);
  const missing = checks.filter(([, v]) => !v).map(([k]) => k);
  return { pct, missing };
}

export async function setAvatarPath(userId, objectKey) {
  const { rows } = await query(
    `UPDATE member_profiles
        SET avatar_path = $1
      WHERE user_id = $2
      RETURNING user_id, avatar_path`,
    [objectKey, userId],
  );
  return rows[0] || null;
}

export async function clearAvatarPath(userId) {
  const { rows } = await query(
    `UPDATE member_profiles
        SET avatar_path = NULL
      WHERE user_id = $1
      RETURNING user_id`,
    [userId],
  );
  return rows[0] || null;
}
