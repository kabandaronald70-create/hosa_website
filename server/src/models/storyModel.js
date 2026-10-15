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
