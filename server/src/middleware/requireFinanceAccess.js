function normalizeRole(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  // Regional titles must map to one canonical workflow role.
  if (
    /^outreach_officer_(?:\((?:eastern|central|western|northern)\)|(?:eastern|central|western|northern))$/.test(
      normalized,
    )
  ) {
    return "regional_outreach_officer";
  }

  return normalized;
}

function getUserRoles(req) {
  return (req.userRoles || []).map(normalizeRole);
}

function getLeadershipRoles(req) {
  return (req.leadershipRoles || []).map(normalizeRole);
}

function denyAccess(req, res, message) {
  req.flash("error", message);
  return res.redirect("/dashboard");
}

/**
 * Full financial access.
 * Only the active Treasurer and Super Admin may use sensitive
 * financial operations, including contribution verification,
 * private payment proofs and financial exports.
 */
export function requireFinanceAccess(req, res, next) {
  const isSuperAdmin = getUserRoles(req).includes("super_admin");
  const isTreasurer = getLeadershipRoles(req).includes("treasurer");

  if (isSuperAdmin || isTreasurer) {
    return next();
  }

  return denyAccess(
    req,
    res,
    "Access denied. Only the Treasurer and Super Admin can perform this financial operation.",
  );
}

/**
 * Financial dashboard access.
 * Treasurer and Super Admin receive the full dashboard.
 * Chairperson receives only the restricted expense-review dashboard.
 */
export function requireFinanceDashboardAccess(req, res, next) {
  const systemRoles = getUserRoles(req);
  const leadershipRoles = getLeadershipRoles(req);

  const isSuperAdmin = systemRoles.includes("super_admin");
  const isTreasurer = leadershipRoles.includes("treasurer");
  const isChairperson = leadershipRoles.includes("chairperson");

  if (isSuperAdmin || isTreasurer || isChairperson) {
    return next();
  }

  return denyAccess(
    req,
    res,
    "Access denied. This dashboard is restricted to the Treasurer, Chairperson and Super Admin.",
  );
}

/**
 * Expense workflow access.
 * The model/controller must still verify that the user's active role
 * matches the expense's current approval stage.
 */
export function requireExpenseWorkflowAccess(req, res, next) {
  const systemRoles = getUserRoles(req);
  const leadershipRoles = getLeadershipRoles(req);

  const allowedLeadershipRoles = [
    "projects_manager",
    "regional_outreach_officer",
    "general_secretary",
    "publicity",
    "treasurer",
    "chairperson",
  ];

  const isSuperAdmin = systemRoles.includes("super_admin");
  const hasAllowedLeadershipRole = leadershipRoles.some((role) =>
    allowedLeadershipRoles.includes(role),
  );

  if (isSuperAdmin || hasAllowedLeadershipRole) {
    return next();
  }

  return denyAccess(
    req,
    res,
    "Access denied. You do not hold an authorized HOSA office for expense management.",
  );
}
