import { query } from "../config/db.js";

export async function createNotification({
  userId,
  type,
  title,
  body = null,
  link = null,
}) {
  const { rows } = await query(
    `INSERT INTO notifications (user_id, type, title, body, link)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [userId, type, title, body, link],
  );
  return rows[0];
}

export async function listMyNotifications(
  userId,
  { unreadOnly = false, limit = 50 } = {},
) {
  const where = ["user_id = $1"];
  if (unreadOnly) where.push("read_at IS NULL");

  const { rows } = await query(
    `SELECT id, type, title, body, link, read_at, created_at
       FROM notifications
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $2`,
    [userId, limit],
  );
  return rows;
}

export async function countUnread(userId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return rows[0].n;
}

export async function markRead(userId, notificationId) {
  const { rowCount } = await query(
    `UPDATE notifications
        SET read_at = now()
      WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
    [notificationId, userId],
  );
  return rowCount > 0;
}

export async function markAllRead(userId) {
  const { rowCount } = await query(
    `UPDATE notifications
        SET read_at = now()
      WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return rowCount;
}
