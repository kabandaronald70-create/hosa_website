import { query } from "../config/db.js";

/** Counts for the admin overview page. */
export async function getAdminCounts() {
  const [members, pendingStories, pendingOpps, upcomingEvents, audits] =
    await Promise.all([
      query(`
        SELECT
          COUNT(*)::int                                                        AS total,
          COUNT(*) FILTER (WHERE mp.verified_at IS NOT NULL)::int             AS verified,
          COUNT(*) FILTER (WHERE u.status = 'suspended')::int                 AS suspended,
          COUNT(*) FILTER (WHERE u.status = 'active')::int                    AS active
        FROM users u
        JOIN member_profiles mp ON mp.user_id = u.id
      `),
      query(`SELECT COUNT(*)::int AS n FROM stories WHERE status = 'pending'`),
      query(
        `SELECT COUNT(*)::int AS n FROM opportunities WHERE status = 'pending'`,
      ),
      query(`
        SELECT COUNT(*)::int AS n
          FROM events
         WHERE status = 'published' AND starts_at >= now()
      `),
      query(`
        SELECT COUNT(*)::int AS n
          FROM audit_logs
         WHERE occurred_at >= now() - interval '7 days'
      `),
    ]);

  return {
    members: members.rows[0],
    pendingStories: pendingStories.rows[0].n,
    pendingOpportunities: pendingOpps.rows[0].n,
    upcomingEvents: upcomingEvents.rows[0].n,
    auditLast7Days: audits.rows[0].n,
  };
}

/** Most recent audit entries for the overview page. */
export async function getRecentAudits(limit = 10) {
  const { rows } = await query(
    `SELECT id, actor_email, action, target_type, target_id, occurred_at
       FROM audit_logs
      ORDER BY occurred_at DESC
      LIMIT $1`,
    [limit],
  );
  return rows;
}
