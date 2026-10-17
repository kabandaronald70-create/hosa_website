import { query } from "../config/db.js";

export async function getEventBySlugForRsvp(slug) {
  const { rows } = await query(
    `SELECT id, slug, title, capacity, registration_deadline, status
       FROM events
      WHERE slug = $1 AND status = 'published'
      LIMIT 1`,
    [slug],
  );
  return rows[0] || null;
}

export async function getRsvpCounts(eventId) {
  const { rows } = await query(
    `SELECT status, COUNT(*)::int AS n
       FROM event_rsvps
      WHERE event_id = $1
      GROUP BY status`,
    [eventId],
  );
  const counts = { going: 0, maybe: 0, cancelled: 0 };
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

export async function getMyRsvp(eventId, userId) {
  const { rows } = await query(
    `SELECT status, updated_at
       FROM event_rsvps
      WHERE event_id = $1 AND user_id = $2
      LIMIT 1`,
    [eventId, userId],
  );
  return rows[0] || null;
}

export async function upsertRsvp(eventId, userId, status) {
  // Enforce capacity: if marking "going" and capacity is set, count existing "going".
  const { rows: eventRows } = await query(
    `SELECT capacity FROM events WHERE id = $1`,
    [eventId],
  );
  const capacity = eventRows[0]?.capacity;

  if (status === "going" && capacity != null) {
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS n
         FROM event_rsvps
        WHERE event_id = $1 AND status = 'going' AND user_id <> $2`,
      [eventId, userId],
    );
    if (countRows[0].n >= capacity) {
      const err = new Error("Event is at capacity.");
      err.status = 409;
      err.code = "EVENT_FULL";
      throw err;
    }
  }

  const { rows } = await query(
    `INSERT INTO event_rsvps (event_id, user_id, status)
     VALUES ($1, $2, $3)
     ON CONFLICT (event_id, user_id)
     DO UPDATE SET status = EXCLUDED.status, updated_at = now()
     RETURNING status, updated_at`,
    [eventId, userId, status],
  );
  return rows[0];
}

export async function deleteRsvp(eventId, userId) {
  const { rowCount } = await query(
    `DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2`,
    [eventId, userId],
  );
  return rowCount > 0;
}

export async function listMyUpcomingRsvps(userId, limit = 10) {
  const { rows } = await query(
    `SELECT e.slug, e.title, e.starts_at, e.venue, r.status
       FROM event_rsvps r
       JOIN events e ON e.id = r.event_id
      WHERE r.user_id = $1
        AND r.status IN ('going','maybe')
        AND e.starts_at >= now()
        AND e.status = 'published'
      ORDER BY e.starts_at ASC
      LIMIT $2`,
    [userId, limit],
  );
  return rows;
}
