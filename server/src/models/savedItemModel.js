import { query } from "../config/db.js";

export async function addSavedItem(userId, itemType, itemId) {
  const allowed = ["event", "story", "opportunity", "member"];
  if (!allowed.includes(itemType)) {
    const err = new Error("Invalid item type.");
    err.status = 400;
    throw err;
  }
  const { rows } = await query(
    `INSERT INTO saved_items (user_id, item_type, item_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, item_type, item_id) DO NOTHING
     RETURNING id, item_type, item_id, created_at`,
    [userId, itemType, itemId],
  );
  return rows[0] || null;
}

export async function removeSavedItem(userId, savedItemId) {
  const { rowCount } = await query(
    `DELETE FROM saved_items WHERE id = $1 AND user_id = $2`,
    [savedItemId, userId],
  );
  return rowCount > 0;
}

export async function listMySavedItems(userId) {
  const { rows } = await query(
    `SELECT id, item_type, item_id, created_at
       FROM saved_items
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 500`,
    [userId],
  );
  return rows;
}

/** Enrich saved items with display data — grouped by type. */
export async function listMySavedEnriched(userId) {
  const base = await listMySavedItems(userId);
  const eventsIds = base
    .filter((r) => r.item_type === "event")
    .map((r) => r.item_id);
  const storySlugs = base
    .filter((r) => r.item_type === "story")
    .map((r) => r.item_id);
  const oppSlugs = base
    .filter((r) => r.item_type === "opportunity")
    .map((r) => r.item_id);
  const memberIds = base
    .filter((r) => r.item_type === "member")
    .map((r) => r.item_id);

  const [events, stories, opps, members] = await Promise.all([
    eventsIds.length === 0
      ? { rows: [] }
      : query(
          `SELECT slug AS id, title, starts_at AS sub, venue AS sub2
         FROM events
        WHERE slug = ANY($1::text[])
          AND status = 'published'`,
          [eventsIds],
        ),
    storySlugs.length === 0
      ? { rows: [] }
      : query(
          `SELECT COALESCE(external_ref, slug) AS id, title, published_at AS sub, category AS sub2
         FROM stories
        WHERE slug = ANY($1::text[]) OR external_ref = ANY($1::text[])`,
          [storySlugs],
        ),
    oppSlugs.length === 0
      ? { rows: [] }
      : query(
          `SELECT slug AS id, title, deadline AS sub, employer AS sub2
         FROM opportunities
        WHERE slug = ANY($1::text[])
          AND status = 'approved'`,
          [oppSlugs],
        ),
    memberIds.length === 0
      ? { rows: [] }
      : query(
          `SELECT mp.user_id::text AS id,
              COALESCE(mp.display_name, mp.first_name || ' ' || mp.last_name) AS title,
              mp.profession AS sub, mp.district AS sub2
         FROM member_profiles mp
        WHERE mp.user_id::text = ANY($1::text[])
          AND mp.public_visibility = TRUE`,
          [memberIds],
        ),
  ]);

  const index = (rows) => {
    const m = new Map();
    for (const r of rows) m.set(String(r.id), r);
    return m;
  };

  return {
    events: base
      .filter((r) => r.item_type === "event")
      .map((r) => ({
        saved: r,
        data: index(events.rows).get(String(r.item_id)),
      }))
      .filter((x) => x.data),
    stories: base
      .filter((r) => r.item_type === "story")
      .map((r) => ({
        saved: r,
        data: index(stories.rows).get(String(r.item_id)),
      }))
      .filter((x) => x.data),
    opportunities: base
      .filter((r) => r.item_type === "opportunity")
      .map((r) => ({ saved: r, data: index(opps.rows).get(String(r.item_id)) }))
      .filter((x) => x.data),
    members: base
      .filter((r) => r.item_type === "member")
      .map((r) => ({
        saved: r,
        data: index(members.rows).get(String(r.item_id)),
      }))
      .filter((x) => x.data),
  };
}
