import { query } from "../config/db.js";

/**
 * Automatically mark any approved opportunity as 'closed'
 * if its deadline has passed.
 */
export async function expireOldOpportunities() {
  await query(
    `UPDATE opportunities 
     SET status = 'closed' 
     WHERE status = 'approved' 
       AND deadline IS NOT NULL 
       AND deadline < now()`,
  );
}

export async function listApprovedOpportunities({
  category,
  page = 1,
  limit = 24,
} = {}) {
  // 1. Run the expiry check first
  await expireOldOpportunities();

  // 2. Only show approved jobs (closed ones are automatically hidden)
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

export async function createPendingOpportunity({
  slug,
  title,
  typeLabel,
  employer,
  location,
  description,
  applicationUrl,
  deadline,
  authorUserId,
}) {
  const { rows } = await query(
    `INSERT INTO opportunities
       (external_ref, slug, title, description,
        employer, organization, location, type_label,
        application_url, deadline,
        submitted_by, posted_by_ref, status)
     VALUES (NULL, $1, $2, $3, $4, $4, $5, $6, $7, $8, $9, NULL, 'pending')
     RETURNING id, slug, title, status, created_at`,
    [
      slug,
      title,
      description,
      employer,
      location,
      typeLabel,
      applicationUrl,
      deadline,
      authorUserId,
    ],
  );
  return rows[0];
}

export async function listMyOpportunities(userId) {
  const { rows } = await query(
    `SELECT id, slug, title, employer, location, type_label,
            status, rejection_reason, deadline, created_at
       FROM opportunities
      WHERE submitted_by = $1
      ORDER BY created_at DESC
      LIMIT 100`,
    [userId],
  );
  return rows;
}

// New addition: fetch a single opportunity by its slug or external_ref
export async function getOpportunityByIdOrRef(idOrSlug) {
  // Run expiry check before fetching a single one too
  await expireOldOpportunities();

  const { rows } = await query(
    `SELECT o.id, o.external_ref, o.slug, o.title, o.description,
            o.employer, o.organization, o.location, o.type_label,
            o.posted_by_ref, o.application_url, o.deadline,
            oc.name AS category, o.created_at
       FROM opportunities o
       LEFT JOIN opportunity_categories oc ON oc.id = o.category_id
      WHERE (o.slug = $1 OR o.external_ref = $1)
        AND o.status = 'approved'
      LIMIT 1`,
    [idOrSlug],
  );
  return rows[0] || null;
}
