import { query, withTransaction } from "../config/db.js";

export async function getMentorPublicById(mentorId) {
  const { rows } = await query(
    `SELECT mp.user_id, mp.display_name, mp.first_name, mp.last_name,
            mp.mentor_field, mp.public_visibility
       FROM member_profiles mp
      WHERE mp.user_id = $1
        AND mp.mentor_opt_in = TRUE
        AND mp.public_visibility = TRUE
      LIMIT 1`,
    [mentorId],
  );
  return rows[0] || null;
}

export async function createRequest({
  requesterId,
  mentorId,
  fieldOfInterest,
  goals,
}) {
  if (requesterId === mentorId) {
    const err = new Error("You cannot request mentorship from yourself.");
    err.status = 400;
    throw err;
  }

  // Prevent duplicate open requests between the same pair.
  const { rows: existing } = await query(
    `SELECT id FROM mentorship_requests
      WHERE requester_user_id = $1
        AND mentor_user_id = $2
        AND status IN ('pending','accepted')
      LIMIT 1`,
    [requesterId, mentorId],
  );
  if (existing.length > 0) {
    const err = new Error("You already have an open request with this mentor.");
    err.status = 409;
    throw err;
  }

  const { rows } = await query(
    `INSERT INTO mentorship_requests
       (requester_user_id, mentor_user_id, field_of_interest, goals, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id, status, created_at`,
    [requesterId, mentorId, fieldOfInterest, goals],
  );
  return rows[0];
}

export async function getRequestById(id) {
  const { rows } = await query(
    `SELECT id, requester_user_id, mentor_user_id, field_of_interest,
            goals, status, created_at, updated_at,
            declined_at, cancelled_at, completed_at
       FROM mentorship_requests
      WHERE id = $1
      LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

export async function setRequestStatus(id, nextStatus) {
  const allowed = ["pending", "accepted", "declined", "completed", "cancelled"];
  if (!allowed.includes(nextStatus)) {
    const err = new Error(`Invalid mentorship status: ${nextStatus}`);
    err.status = 400;
    throw err;
  }

  const stamp =
    nextStatus === "declined"
      ? "declined_at = now()"
      : nextStatus === "cancelled"
        ? "cancelled_at = now()"
        : nextStatus === "completed"
          ? "completed_at = now()"
          : "";

  const { rows } = await query(
    `UPDATE mentorship_requests
        SET status = $1
            ${stamp ? `, ${stamp}` : ""}
      WHERE id = $2
      RETURNING id, status, requester_user_id, mentor_user_id`,
    [nextStatus, id],
  );
  return rows[0] || null;
}

export async function listMyRequests(userId) {
  const [sent, received] = await Promise.all([
    query(
      `SELECT mr.id, mr.field_of_interest, mr.goals, mr.status, mr.created_at,
              mp.display_name, mp.first_name, mp.last_name
         FROM mentorship_requests mr
         JOIN member_profiles mp ON mp.user_id = mr.mentor_user_id
        WHERE mr.requester_user_id = $1
        ORDER BY mr.created_at DESC
        LIMIT 50`,
      [userId],
    ),
    query(
      `SELECT mr.id, mr.field_of_interest, mr.goals, mr.status, mr.created_at,
              mp.display_name, mp.first_name, mp.last_name
         FROM mentorship_requests mr
         JOIN member_profiles mp ON mp.user_id = mr.requester_user_id
        WHERE mr.mentor_user_id = $1
        ORDER BY mr.created_at DESC
        LIMIT 50`,
      [userId],
    ),
  ]);
  return { sent: sent.rows, received: received.rows };
}
