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

// ---------------------------------------------------------------------------
// Member management
// ---------------------------------------------------------------------------

const MEMBER_COLUMNS = `
  u.id, u.email, u.status, u.email_verified_at,
  u.created_at, u.last_login_at,
  mp.seed_ref, mp.first_name, mp.last_name, mp.display_name,
  mp.graduation_year, mp.district, mp.country_code, mp.profession,
  mp.verified_at, mp.public_visibility, mp.avatar_path,
  COALESCE(array_agg(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
`;

/**
 * Paginated + filtered member list. Search across email, name, profession.
 * Filters: status (active/suspended/deactivated), role name, verified (bool).
 */
export async function listMembers({
  q,
  status,
  role,
  verified,
  page = 1,
  limit = 25,
} = {}) {
  const where = [];
  const values = [];
  let i = 1;

  if (q) {
    where.push(`(
      u.email ILIKE $${i}
      OR mp.first_name ILIKE $${i}
      OR mp.last_name  ILIKE $${i}
      OR (mp.first_name || ' ' || mp.last_name) ILIKE $${i}
    )`);
    values.push(`%${q}%`);
    i += 1;
  }
  if (status) {
    where.push(`u.status = $${i}`);
    values.push(status);
    i += 1;
  }
  if (verified === true) where.push(`mp.verified_at IS NOT NULL`);
  if (verified === false) where.push(`mp.verified_at IS NULL`);
  if (role) {
    where.push(`
      EXISTS (
        SELECT 1 FROM user_roles ur2
          JOIN roles r2 ON r2.id = ur2.role_id
         WHERE ur2.user_id = u.id AND r2.name = $${i}
      )
    `);
    values.push(role);
    i += 1;
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM users u
       JOIN member_profiles mp ON mp.user_id = u.id
       ${whereSql}`,
    values,
  );

  const { rows } = await query(
    `SELECT ${MEMBER_COLUMNS}
       FROM users u
       JOIN member_profiles mp ON mp.user_id = u.id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       ${whereSql}
      GROUP BY u.id, mp.user_id
      ORDER BY mp.verified_at NULLS FIRST, u.created_at DESC
      LIMIT $${i} OFFSET $${i + 1}`,
    [...values, limit, offset],
  );

  return {
    rows,
    total: countRows[0].total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(countRows[0].total / limit)),
  };
}

export async function getMemberForAdmin(userId) {
  const { rows } = await query(
    `SELECT ${MEMBER_COLUMNS}
       FROM users u
       JOIN member_profiles mp ON mp.user_id = u.id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
      GROUP BY u.id, mp.user_id
      LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

export async function setMemberVerified(userId, verified) {
  const { rows } = await query(
    `UPDATE member_profiles
        SET verified_at = ${verified ? "now()" : "NULL"}
      WHERE user_id = $1
      RETURNING user_id, verified_at`,
    [userId],
  );
  return rows[0] || null;
}

export async function setUserStatus(userId, status) {
  const allowed = ["active", "suspended", "deactivated"];
  if (!allowed.includes(status)) {
    const err = new Error(`Invalid status: ${status}`);
    err.status = 400;
    throw err;
  }
  const { rows } = await query(
    `UPDATE users SET status = $1 WHERE id = $2
     RETURNING id, email, status`,
    [status, userId],
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Moderation: stories
// ---------------------------------------------------------------------------

export async function listPendingStories({ page = 1, limit = 25 } = {}) {
  const offset = (page - 1) * limit;
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM stories WHERE status = 'pending'`,
  );
  const { rows } = await query(
    `SELECT s.id, s.slug, s.title, s.excerpt, s.body,
            s.author_name, s.author_ref, s.class_year, s.category,
            s.status, s.created_at
       FROM stories s
      WHERE s.status = 'pending'
      ORDER BY s.created_at ASC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return {
    rows,
    total: countRows[0].total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(countRows[0].total / limit)),
  };
}

export async function getStoryForModeration(storyId) {
  const { rows } = await query(
    `SELECT id, slug, title, body, excerpt, author_name, author_ref,
            author_user_id, class_year, category, status, created_at
       FROM stories WHERE id = $1 LIMIT 1`,
    [storyId],
  );
  return rows[0] || null;
}

export async function setStoryStatus(
  storyId,
  status,
  { reason = null, moderatorId = null } = {},
) {
  const allowed = ["pending", "published", "rejected", "archived", "draft"];
  if (!allowed.includes(status)) {
    const err = new Error(`Invalid story status: ${status}`);
    err.status = 400;
    throw err;
  }
  const publishedAt = status === "published" ? "now()" : "NULL";
  const { rows } = await query(
    `UPDATE stories
        SET status = $1,
            rejection_reason = $2,
            reviewed_by = $3,
            reviewed_at = now(),
            published_at = ${publishedAt}
      WHERE id = $4
      RETURNING id, slug, title, status, published_at, rejection_reason`,
    [status, reason, moderatorId, storyId],
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Moderation: opportunities
// ---------------------------------------------------------------------------

export async function listPendingOpportunities({ page = 1, limit = 25 } = {}) {
  const offset = (page - 1) * limit;
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM opportunities WHERE status = 'pending'`,
  );
  const { rows } = await query(
    `SELECT o.id, o.slug, o.title, o.description,
            o.employer, o.organization, o.location, o.type_label,
            o.posted_by_ref, o.deadline, o.created_at
       FROM opportunities o
      WHERE o.status = 'pending'
      ORDER BY o.created_at ASC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return {
    rows,
    total: countRows[0].total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(countRows[0].total / limit)),
  };
}

export async function getOpportunityForModeration(opportunityId) {
  const { rows } = await query(
    `SELECT id, slug, title, description, employer, organization,
            location, type_label, posted_by_ref, submitted_by, deadline, status, created_at
       FROM opportunities WHERE id = $1 LIMIT 1`,
    [opportunityId],
  );
  return rows[0] || null;
}

export async function setOpportunityStatus(
  opportunityId,
  status,
  { reason = null, moderatorId = null } = {},
) {
  const allowed = ["pending", "approved", "rejected", "archived", "expired"];
  if (!allowed.includes(status)) {
    const err = new Error(`Invalid opportunity status: ${status}`);
    err.status = 400;
    throw err;
  }
  const { rows } = await query(
    `UPDATE opportunities
        SET status = $1,
            rejection_reason = $2,
            reviewed_by = $3,
            reviewed_at = now()
      WHERE id = $4
      RETURNING id, slug, title, status, rejection_reason`,
    [status, reason, moderatorId, opportunityId],
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const EVENT_COLUMNS = `
  e.id, e.external_ref, e.slug, e.title, e.description,
  e.starts_at, e.ends_at, e.timezone,
  e.venue, e.district, e.latitude, e.longitude, e.event_type,
  e.capacity, e.registration_deadline, e.accessibility,
  e.status, e.published_at, e.internal_notes,
  e.created_at, e.updated_at
`;

export async function listAllEvents({
  q,
  status,
  when, // 'upcoming' | 'past' | ''
  page = 1,
  limit = 25,
} = {}) {
  const where = [];
  const values = [];
  let i = 1;

  if (q) {
    where.push(`e.title ILIKE $${i}`);
    values.push(`%${q}%`);
    i += 1;
  }
  if (status) {
    where.push(`e.status = $${i}`);
    values.push(status);
    i += 1;
  }
  if (when === "upcoming") {
    where.push(`e.starts_at >= now()`);
  } else if (when === "past") {
    where.push(`e.starts_at < now()`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM events e ${whereSql}`,
    values,
  );

  const { rows } = await query(
    `SELECT ${EVENT_COLUMNS}
       FROM events e
       ${whereSql}
      ORDER BY e.starts_at DESC
      LIMIT $${i} OFFSET $${i + 1}`,
    [...values, limit, offset],
  );

  return {
    rows,
    total: countRows[0].total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(countRows[0].total / limit)),
  };
}

export async function getEventById(id) {
  const { rows } = await query(
    `SELECT ${EVENT_COLUMNS} FROM events e WHERE e.id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

export async function slugExists(slug) {
  const { rows } = await query(`SELECT 1 FROM events WHERE slug = $1 LIMIT 1`, [
    slug,
  ]);
  return rows.length > 0;
}

export async function createEvent(fields, createdBy) {
  const { rows } = await query(
    `INSERT INTO events
       (slug, title, description, starts_at, ends_at, timezone,
        venue, district, capacity, registration_deadline, accessibility,
        internal_notes, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             $12, 'draft', $13)
     RETURNING id, slug, title, status, starts_at`,
    [
      fields.slug,
      fields.title,
      fields.description,
      fields.starts_at,
      fields.ends_at,
      fields.timezone,
      fields.venue,
      fields.district,
      fields.capacity,
      fields.registration_deadline,
      fields.accessibility,
      fields.internal_notes,
      createdBy,
    ],
  );
  return rows[0];
}

export async function updateEvent(id, fields) {
  const { rows } = await query(
    `UPDATE events
        SET title = $1,
            description = $2,
            starts_at = $3,
            ends_at = $4,
            timezone = $5,
            venue = $6,
            district = $7,
            capacity = $8,
            registration_deadline = $9,
            accessibility = $10,
            internal_notes = $11
      WHERE id = $12
      RETURNING id, slug, title, status`,
    [
      fields.title,
      fields.description,
      fields.starts_at,
      fields.ends_at,
      fields.timezone,
      fields.venue,
      fields.district,
      fields.capacity,
      fields.registration_deadline,
      fields.accessibility,
      fields.internal_notes,
      id,
    ],
  );
  return rows[0] || null;
}

export async function setEventStatus(id, status) {
  const allowed = ["draft", "published", "cancelled", "archived"];
  if (!allowed.includes(status)) {
    const err = new Error(`Invalid event status: ${status}`);
    err.status = 400;
    throw err;
  }
  const publishedAt =
    status === "published" ? "COALESCE(published_at, now())" : "published_at";
  const { rows } = await query(
    `UPDATE events
        SET status = $1, published_at = ${publishedAt}
      WHERE id = $2
      RETURNING id, slug, title, status, published_at`,
    [status, id],
  );
  return rows[0] || null;
}

export async function getEventRsvpCounts(eventId) {
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

// ---------------------------------------------------------------------------
// Audit log viewer
// ---------------------------------------------------------------------------

const AUDIT_COLUMNS = `
  a.id, a.actor_user_id, a.actor_email, a.action,
  a.target_type, a.target_id, a.metadata,
  a.ip_address, a.user_agent, a.occurred_at
`;

/**
 * Filtered, paginated audit log.
 * Filters:
 *   actor        — substring of actor_email (ILIKE)
 *   action       — exact match
 *   targetType   — exact match
 *   from, to     — ISO date strings (inclusive day boundaries)
 */
export async function listAuditLogs({
  actor,
  action,
  targetType,
  from,
  to,
  page = 1,
  limit = 50,
} = {}) {
  const where = [];
  const values = [];
  let i = 1;

  if (actor) {
    where.push(`a.actor_email ILIKE $${i}`);
    values.push(`%${actor}%`);
    i += 1;
  }
  if (action) {
    where.push(`a.action = $${i}`);
    values.push(action);
    i += 1;
  }
  if (targetType) {
    where.push(`a.target_type = $${i}`);
    values.push(targetType);
    i += 1;
  }
  if (from) {
    where.push(`a.occurred_at >= $${i}::timestamptz`);
    values.push(from);
    i += 1;
  }
  if (to) {
    // Treat "to" as end-of-day inclusive.
    where.push(`a.occurred_at < ($${i}::date + interval '1 day')`);
    values.push(to);
    i += 1;
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM audit_logs a ${whereSql}`,
    values,
  );

  const { rows } = await query(
    `SELECT ${AUDIT_COLUMNS}
       FROM audit_logs a
       ${whereSql}
      ORDER BY a.occurred_at DESC
      LIMIT $${i} OFFSET $${i + 1}`,
    [...values, limit, offset],
  );

  return {
    rows,
    total: countRows[0].total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(countRows[0].total / limit)),
  };
}

/** Same filters as listAuditLogs but hard-capped for CSV export. */
export async function listAuditLogsForExport(filters, cap = 5000) {
  const result = await listAuditLogs({ ...filters, page: 1, limit: cap });
  return result.rows;
}

export async function getAuditLogById(id) {
  const { rows } = await query(
    `SELECT ${AUDIT_COLUMNS} FROM audit_logs a WHERE a.id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

/** Distinct list of every action string that has ever been logged. */
export async function listAuditActions() {
  const { rows } = await query(
    `SELECT DISTINCT action FROM audit_logs ORDER BY action`,
  );
  return rows.map((r) => r.action);
}

/** Distinct list of every target_type that has ever been logged. */
export async function listAuditTargetTypes() {
  const { rows } = await query(
    `SELECT DISTINCT target_type FROM audit_logs
      WHERE target_type IS NOT NULL
      ORDER BY target_type`,
  );
  return rows.map((r) => r.target_type);
}
