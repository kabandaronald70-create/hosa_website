import { getProfileByUserId, updateProfile } from "../models/profileModel.js";
import { query } from "../config/db.js";
import { hashPassword, verifyPassword } from "./passwordService.js";
import { findUserById } from "../models/userModel.js";
import { logger } from "../utils/logger.js";

/**
 * Update a member's profile. Ownership is enforced by userId.
 * Returns { profile, roleChanges } — roleChanges lists any roles to add/remove.
 */
export async function saveProfile(userId, data) {
  const {
    first_name,
    last_name,
    display_name,
    graduation_year,
    profession,
    organization,
    district,
    country_code,
    biography,
    skills,
    career_history,
    email_privacy,
    phone_privacy,
    district_privacy, // <-- New fields
    mentor_opt_in,
    public_visibility,
    phone,
    preferred_contact,
  } = data;

  // Convert checkboxes to booleans
  const isMentor = mentor_opt_in === "on" || mentor_opt_in === true;
  const isVisible = public_visibility === "on" || public_visibility === true;

  await query(
    `UPDATE member_profiles SET
      first_name = $1, last_name = $2, display_name = $3, graduation_year = $4,
      profession = $5, organization = $6, district = $7, country_code = $8,
      biography = $9, skills = $10, career_history = $11,
      email_privacy = $12, phone_privacy = $13, district_privacy = $14,
      mentor_opt_in = $15, public_visibility = $16,
      phone = $17, preferred_contact = $18,
      updated_at = now()
    WHERE user_id = $19`,
    [
      first_name,
      last_name,
      display_name,
      graduation_year || null,
      profession,
      organization,
      district,
      country_code,
      biography,
      skills,
      career_history,
      email_privacy,
      phone_privacy,
      district_privacy,
      isMentor,
      isVisible,
      phone,
      preferred_contact,
      userId,
    ],
  );
}

export async function changePassword(
  userId,
  { current_password, new_password },
) {
  const user = await findUserById(userId);
  if (!user) {
    const err = new Error("Account not found.");
    err.status = 404;
    err.code = "USER_NOT_FOUND";
    throw err;
  }

  const ok = await verifyPassword(user.password_hash, current_password);
  if (!ok) {
    const err = new Error("Current password is incorrect.");
    err.status = 401;
    err.code = "WRONG_PASSWORD";
    throw err;
  }

  const newHash = await hashPassword(new_password);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
    newHash,
    userId,
  ]);

  return { ok: true };
}

/**
 * Delete every session row that belongs to this user except the given sid.
 * We detect "belongs to user" by decoding the session JSON stored by connect-pg-simple.
 */
export async function invalidateOtherSessions(userId, keepSid) {
  const { rows } = await query(
    `SELECT sid, sess FROM session WHERE sid <> $1`,
    [keepSid],
  );
  let removed = 0;
  for (const row of rows) {
    try {
      const sess =
        typeof row.sess === "string" ? JSON.parse(row.sess) : row.sess;
      if (sess && sess.userId === userId) {
        await query(`DELETE FROM session WHERE sid = $1`, [row.sid]);
        removed += 1;
      }
    } catch (err) {
      logger.warn({ err, sid: row.sid }, "Failed to parse session row");
    }
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Role helpers (thin wrappers to keep SQL close to intent)
// ---------------------------------------------------------------------------

async function hasRole(userId, roleName) {
  const { rows } = await query(
    `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1 AND r.name = $2 LIMIT 1`,
    [userId, roleName],
  );
  return rows.length > 0;
}

async function grantRole(userId, roleName) {
  await query(
    `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name = $2
     ON CONFLICT DO NOTHING`,
    [userId, roleName],
  );
}

async function revokeRole(userId, roleName) {
  await query(
    `DELETE FROM user_roles
      WHERE user_id = $1
        AND role_id = (SELECT id FROM roles WHERE name = $2)`,
    [userId, roleName],
  );
}
