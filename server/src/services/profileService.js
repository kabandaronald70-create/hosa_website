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
  const fields = {
    first_name: data.first_name,
    last_name: data.last_name,
    display_name: data.display_name || null,
    graduation_year: data.graduation_year ?? null,
    biography: data.biography || null,
    profession: data.profession || null,
    organization: data.organization || null,
    district: data.district || null,
    country_code: data.country_code || null,
    phone: data.phone || null,
    preferred_contact: data.preferred_contact || null,
    skills: data.skills || null,
    interests: data.interests || null,
    career_history: data.career_history || null,
    mentor_opt_in: Boolean(data.mentor_opt_in),
    public_visibility: data.public_visibility !== false, // default true if omitted
    show_email: Boolean(data.show_email),
    show_phone: Boolean(data.show_phone),
  };

  const before = await getProfileByUserId(userId);
  const profile = await updateProfile(userId, fields);

  // Sync the 'mentor' role to mentor_opt_in.
  const wasMentor = await hasRole(userId, "mentor");
  const shouldBeMentor = fields.mentor_opt_in;

  if (shouldBeMentor && !wasMentor) {
    await grantRole(userId, "mentor");
  } else if (!shouldBeMentor && wasMentor) {
    // Only remove the mentor role; never touch member/admin/moderator here.
    await revokeRole(userId, "mentor");
  }

  return { profile, before };
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

  // Invalidate all other sessions for this user, keeping the current one.
  // Requires knowing the current sid — pass it in via the caller.
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
