import { query } from "../config/db.js";

export async function listApprovedOpportunities({
  category,
  page = 1,
  limit = 24,
} = {}) {
  const where = [`o.status = 'approved'`];
  const values = [];
  let i = 1;

  if (category) {
    where.push(`oc.name = $${i}`);
    values.push(category);
    i += 1;
  }

  const offset = (page - 1) * limit;

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM opportunities o
       LEFT JOIN opportunity_categories oc ON oc.id = o.category_id
      WHERE ${where.join(" AND ")}`,
    values,
  );

  const { rows } = await query(
    `SELECT o.id, o.external_ref, o.slug, o.title, o.description,
            o.employer, o.organization, o.location, o.type_label,
            o.posted_by_ref, o.application_url, o.deadline,
            oc.name AS category, o.created_at
       FROM opportunities o
       LEFT JOIN opportunity_categories oc ON oc.id = o.category_id
      WHERE ${where.join(" AND ")}
      ORDER BY o.deadline DESC NULLS LAST, o.created_at DESC
      LIMIT $${i} OFFSET $${i + 1}`,
    [...values, limit, offset],
  );

  return { rows, total: countRows[0].total, page, limit };
}
