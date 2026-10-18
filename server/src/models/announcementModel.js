import { query } from "../config/db.js";

export async function showAnnouncements(req, res, next) {
  try {
    const announcements = await listAnnouncements(20);
    res.render("announcements/list", {
      title: "Announcements — HOSA",
      layout: "layouts/public",
      announcements,
    });
  } catch (err) {
    next(err);
  }
}

export async function listAnnouncements(limit = 10) {
  const { rows } = await query(
    `SELECT a.id, a.title, a.body, a.pinned, a.created_at,
            COALESCE(mp.display_name, mp.first_name || ' ' || mp.last_name) AS author_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.author_id
       LEFT JOIN member_profiles mp ON mp.user_id = u.id
      ORDER BY a.pinned DESC, a.created_at DESC
      LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function createAnnouncement({ title, body, pinned, authorId }) {
  const { rows } = await query(
    `INSERT INTO announcements (title, body, pinned, author_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, pinned, created_at`,
    [title, body, pinned, authorId],
  );
  return rows[0];
}

export async function deleteAnnouncement(id) {
  await query(`DELETE FROM announcements WHERE id = $1`, [id]);
}
