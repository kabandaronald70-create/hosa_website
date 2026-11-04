import { query } from "../config/db.js";

// --- Membership Analytics ---
export async function getMembershipStats() {
  const totalUsers = await query(`SELECT COUNT(*)::int AS n FROM users`);
  const approvedUsers = await query(
    `SELECT COUNT(*)::int AS n FROM users WHERE membership_approved_at IS NOT NULL`,
  );
  const pendingUsers = await query(
    `SELECT COUNT(*)::int AS n FROM users WHERE membership_approved_at IS NULL AND status = 'active'`,
  );

  // Fixed SQL syntax for monthly growth
  const monthlyGrowth = await query(`
    SELECT TO_CHAR(created_at, 'Mon YYYY') AS month, COUNT(*)::int AS count
    FROM users
    WHERE created_at >= NOW() - INTERVAL '6 months'
    GROUP BY TO_CHAR(created_at, 'Mon YYYY')
    ORDER BY MIN(created_at) ASC
  `);

  return {
    total: totalUsers.rows[0].n,
    approved: approvedUsers.rows[0].n,
    pending: pendingUsers.rows[0].n,
    growth: monthlyGrowth.rows,
  };
}

// --- Financial Analytics ---
export async function getFinancialStats() {
  const income = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM contributions WHERE status = 'verified'`,
  );
  const expenses = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE status IN ('approved', 'paid')`,
  );
  const pendingContribs = await query(
    `SELECT COUNT(*)::int AS n FROM contributions WHERE status = 'pending'`,
  );

  return {
    totalIncome: Number(income.rows[0].total),
    totalExpenses: Number(expenses.rows[0].total),
    netBalance: Number(income.rows[0].total) - Number(expenses.rows[0].total),
    pendingContribs: pendingContribs.rows[0].n,
  };
}

// --- Project Analytics ---
export async function getProjectStats() {
  const total = await query(`SELECT COUNT(*)::int AS n FROM projects`);
  const proposed = await query(
    `SELECT COUNT(*)::int AS n FROM projects WHERE status = 'proposed'`,
  );
  const active = await query(
    `SELECT COUNT(*)::int AS n FROM projects WHERE status IN ('approved', 'in_progress')`,
  );
  const completed = await query(
    `SELECT COUNT(*)::int AS n FROM projects WHERE status = 'completed'`,
  );

  const funding = await query(`
    SELECT 
      COALESCE(SUM(budget), 0) AS total_budget, 
      COALESCE(SUM(funds_raised), 0) AS total_raised 
    FROM projects
  `);

  return {
    total: total.rows[0].n,
    proposed: proposed.rows[0].n,
    active: active.rows[0].n,
    completed: completed.rows[0].n,
    totalBudget: Number(funding.rows[0].total_budget),
    totalRaised: Number(funding.rows[0].total_raised),
  };
}

// --- NEW: Regional Reports Analytics ---
export async function getRegionalStats() {
  const reports = await query(`
    SELECT 
      COUNT(*)::int AS total_reports,
      COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS pending_reports,
      COUNT(CASE WHEN status = 'reviewed' THEN 1 END)::int AS reviewed_reports
    FROM regional_reports
  `);

  const byRegion = await query(`
    SELECT region, COUNT(*)::int AS count 
    FROM regional_reports 
    GROUP BY region
  `);

  return {
    totalReports: reports.rows[0].total_reports,
    pendingReports: reports.rows[0].pending_reports,
    reviewedReports: reports.rows[0].reviewed_reports,
    byRegion: byRegion.rows,
  };
}

// --- Business Analytics ---
export async function getBusinessStats() {
  const total = await query(`SELECT COUNT(*)::int AS n FROM businesses`);
  const approved = await query(
    `SELECT COUNT(*)::int AS n FROM businesses WHERE status = 'approved'`,
  );
  const pending = await query(
    `SELECT COUNT(*)::int AS n FROM businesses WHERE status = 'pending'`,
  );

  return {
    total: total.rows[0].n,
    approved: approved.rows[0].n,
    pending: pending.rows[0].n,
  };
}

// --- Engagement Analytics ---
export async function getEngagementStats() {
  const events = await query(`SELECT COUNT(*)::int AS n FROM events`);
  const stories = await query(`SELECT COUNT(*)::int AS n FROM stories`);
  const opportunities = await query(
    `SELECT COUNT(*)::int AS n FROM opportunities`,
  );
  const mentorship = await query(
    `SELECT COUNT(*)::int AS n FROM mentorship_requests`,
  );

  return {
    events: events.rows[0].n,
    stories: stories.rows[0].n,
    opportunities: opportunities.rows[0].n,
    mentorship: mentorship.rows[0].n,
  };
}
