import { query } from "../config/db.js";

export async function listPublishedStories({ page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM stories WHERE status = 'published'`,
  );

  const { rows } = await query(
    `SELECT id, external_ref, slug, title, body, excerpt, image_path,
            author_name, author_ref, class_year, category,
            story_date, published_at, created_at
       FROM stories
      WHERE status = 'published'
      ORDER BY published_at DESC NULLS LAST, created_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );

  return { rows, total: countRows[0].total, page, limit };
}

export async function createPendingStory({
  slug,
  title,
  body,
  excerpt,
  category,
  authorUserId,
}) {
  const { rows } = await query(
    `INSERT INTO stories
       (external_ref, slug, title, body, excerpt, category,
        submitted_by_user_id, author_user_id, status)
     VALUES (NULL, $1, $2, $3, $4, $5, $6, $6, 'pending')
     RETURNING id, slug, title, status, created_at`,
    [slug, title, body, excerpt, category, authorUserId],
  );
  return rows[0];
}

export async function listMyStories(userId) {
  const { rows } = await query(
    `SELECT id, slug, title, excerpt, category, status,
            rejection_reason, created_at, published_at
       FROM stories
      WHERE submitted_by_user_id = $1
      ORDER BY created_at DESC
      LIMIT 100`,
    [userId],
  );
  return rows;
}
