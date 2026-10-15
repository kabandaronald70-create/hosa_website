import { query } from "../config/db.js";

export async function listPublishedEvents({
  from,
  to,
  page = 1,
  limit = 24,
} = {}) {
  const where = [`status = 'published'`];
  const values = [];
  let i = 1;

  if (from) {
    where.push(`starts_at >= $${i}`);
    values.push(new Date(from).toISOString());
    i += 1;
  }
  if (to) {
    where.push(`starts_at <= $${i}`);
    values.push(new Date(to).toISOString());
    i += 1;
  }

  const offset = (page - 1) * limit;

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM events WHERE ${where.join(" AND ")}`,
    values,
  );

  const { rows } = await query(
    `SELECT id, external_ref, slug, title, description,
            starts_at, ends_at, timezone,
            venue, district, latitude, longitude, event_type,
            capacity, registration_deadline, accessibility, status,
            published_at, created_at
       FROM events
      WHERE ${where.join(" AND ")}
      ORDER BY starts_at DESC
      LIMIT $${i} OFFSET $${i + 1}`,
    [...values, limit, offset],
  );

  return { rows, total: countRows[0].total, page, limit };
}

export async function getEventBySlug(slug) {
  const { rows } = await query(
    `SELECT id, external_ref, slug, title, description,
            starts_at, ends_at, timezone,
            venue, district, latitude, longitude, event_type,
            capacity, registration_deadline, accessibility, status,
            published_at, created_at
       FROM events
      WHERE slug = $1 AND status = 'published'
      LIMIT 1`,
    [slug],
  );
  return rows[0] || null;
}
