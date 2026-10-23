import { query } from "../config/db.js";

export async function listActiveRequests() {
  const { rows } = await query(
    `SELECT br.*, mp.first_name, mp.last_name, mp.organization 
     FROM business_requests br
     JOIN users u ON br.user_id = u.id
     LEFT JOIN member_profiles mp ON u.id = mp.user_id
     WHERE br.status = 'active'
       AND br.created_at >= NOW() - INTERVAL '14 days'  -- <-- Auto-expires after 14 days
       AND (br.expires_at IS NULL OR br.expires_at > now())
     ORDER BY br.created_at DESC`,
  );
  return rows;
}

export async function getUserRequests(userId) {
  const { rows } = await query(
    `SELECT * FROM business_requests 
     WHERE user_id = $1 
     ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

export async function createRequest({
  userId,
  requestType,
  title,
  description,
  contactMethod,
  expiresAt,
}) {
  const { rows } = await query(
    `INSERT INTO business_requests 
       (user_id, request_type, title, description, contact_method, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, requestType, title, description, contactMethod, expiresAt || null],
  );
  return rows[0];
}

export async function closeRequest(id, userId) {
  await query(
    `UPDATE business_requests SET status = 'closed' WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
}

export async function hasPostedTwoRequestsThisMonth(userId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count 
     FROM business_requests 
     WHERE user_id = $1 
     AND created_at >= DATE_TRUNC('month', NOW())`,
    [userId],
  );
  return rows[0].count >= 2;
}
