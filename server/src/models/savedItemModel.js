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
  const storyIds = base
    .filter((r) => r.item_type === "story")
    .map((r) => r.item_id);
  const oppIds = base
    .filter((r) => r.item_type === "opportunity")
    .map((r) => r.item_id);
  const memberIds = base
    .filter((r) => r.item_type === "member")
    .map((r) => r.item_id);

  const [events, stories, opps, members] = await Promise.all([
    eventsIds.length === 0
      ? { rows: [] }
      : query(
          `SELECT id, slug, title, starts_at AS sub, venue AS sub2
       FROM events
       WHERE id::text = ANY($1::text[]) OR slug = ANY($1::text[])`,
          [eventsIds],
        ),
    storyIds.length === 0
      ? { rows: [] }
      : query(
          `SELECT id, slug, external_ref, title, published_at AS sub, category AS sub2
       FROM stories
       WHERE id::text = ANY($1::text[]) OR slug = ANY($1::text[]) OR external_ref = ANY($1::text[])`,
          [storyIds],
        ),
    oppIds.length === 0
      ? { rows: [] }
      : query(
          `SELECT id, slug, external_ref, title, deadline AS sub, employer AS sub2
       FROM opportunities
       WHERE id::text = ANY($1::text[]) OR slug = ANY($1::text[]) OR external_ref = ANY($1::text[])`,
          [oppIds],
        ),
    memberIds.length === 0
      ? { rows: [] }
      : query(
          `SELECT user_id AS id, seed_ref, 
              COALESCE(display_name, first_name || ' ' || last_name) AS title,
              profession AS sub, district AS sub2
       FROM member_profiles
       WHERE user_id::text = ANY($1::text[]) OR seed_ref = ANY($1::text[])`,
          [memberIds],
        ),
  ]);

  const findMatch = (rows, savedId) => {
    return rows.find(
      (r) =>
        String(r.id) === String(savedId) ||
        String(r.slug) === String(savedId) ||
        String(r.external_ref) === String(savedId) ||
        String(r.seed_ref) === String(savedId),
    );
  };

  const processGroup = (type, rows) => {
    return base
      .filter((r) => r.item_type === type)
      .map((r) => ({ saved: r, data: findMatch(rows, r.item_id) }))
      .filter((x) => x.data);
  };

  return {
    events: processGroup("event", events.rows),
    stories: processGroup("story", stories.rows),
    opportunities: processGroup("opportunity", opps.rows),
    members: processGroup("member", members.rows),
  };
}
