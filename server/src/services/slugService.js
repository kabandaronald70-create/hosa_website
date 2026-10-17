import { query } from "../config/db.js";

const ALLOWED_TABLES = new Set(["stories", "opportunities", "events"]);

export function slugify(text) {
  return (
    String(text)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

async function existsIn(table, slug) {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`slugService: table not allowed: ${table}`);
  }
  const { rows } = await query(
    `SELECT 1 FROM ${table} WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  return rows.length > 0;
}

export async function uniqueSlug(table, baseTitle) {
  const base = slugify(baseTitle);
  if (!(await existsIn(table, base))) return base;
  for (let n = 2; n <= 50; n += 1) {
    const candidate = `${base}-${n}`;
    if (!(await existsIn(table, candidate))) return candidate;
  }
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}
