import { query } from "../config/db.js";
import { logger } from "../utils/logger.js";

let announcementReadsTableAvailable;
let announcementReadsTableCheckedAt = 0;
const SCHEMA_CHECK_TTL_MS = 60_000;

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

async function hasAnnouncementReadsTable() {
  if (Date.now() - announcementReadsTableCheckedAt < SCHEMA_CHECK_TTL_MS) {
    return announcementReadsTableAvailable;
  }

  const { rows } = await query(
    "SELECT to_regclass('public.announcement_reads') IS NOT NULL AS available",
  );
  announcementReadsTableAvailable = rows[0].available;
  announcementReadsTableCheckedAt = Date.now();

  if (!announcementReadsTableAvailable) {
    logger.warn(
      "Announcement read tracking is unavailable; apply migration 021_announcement_reads.sql",
    );
  }

  return announcementReadsTableAvailable;
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

export async function listActiveAnnouncements(limit = 10, userId = null) {
  const canTrackReads = userId && (await hasAnnouncementReadsTable());
  const unreadFilter = canTrackReads
    ? `AND NOT EXISTS (
         SELECT 1
           FROM announcement_reads ar
          WHERE ar.announcement_id = a.id AND ar.user_id = $2
       )`
    : "";
  const { rows } = await query(
    `SELECT a.id, a.title, a.body, a.pinned, a.created_at,
            COALESCE(mp.display_name, mp.first_name || ' ' || mp.last_name) AS author_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.author_id
       LEFT JOIN member_profiles mp ON mp.user_id = u.id
      WHERE a.created_at >= now() - interval '7 days'
        ${unreadFilter}
      ORDER BY a.created_at DESC
      LIMIT $1`,
    canTrackReads ? [limit, userId] : [limit],
  );
  return rows;
}

export async function countAnnouncementBadge(userId = null) {
  const canTrackReads = userId && (await hasAnnouncementReadsTable());
  const unreadFilter = canTrackReads
    ? `AND NOT EXISTS (
         SELECT 1
           FROM announcement_reads ar
          WHERE ar.announcement_id = a.id AND ar.user_id = $1
       )`
    : "";
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n
       FROM announcements a
      WHERE a.created_at >= now() - interval '7 days'
        ${unreadFilter}`,
    canTrackReads ? [userId] : [],
  );
  return rows[0].n;
}

export async function markAnnouncementRead(id, userId) {
  if (!(await hasAnnouncementReadsTable())) return null;

  const { rowCount } = await query(
    `INSERT INTO announcement_reads (announcement_id, user_id)
     SELECT a.id, $2
       FROM announcements a
      WHERE a.id = $1 AND a.created_at >= now() - interval '7 days'
     ON CONFLICT (announcement_id, user_id)
     DO UPDATE SET read_at = announcement_reads.read_at
     RETURNING announcement_id`,
    [id, userId],
  );
  return rowCount > 0;
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
