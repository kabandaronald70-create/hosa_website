export function requireFinanceAccess(req, res, next) {
  const roles = req.userRoles || [];
  const leadershipRoles = req.leadershipRoles || [];

  const isSuperAdmin = roles.includes("super_admin");
  const isChairperson = leadershipRoles.includes("Chairperson");
  const isTreasurer = leadershipRoles.includes("Treasurer");

  if (isSuperAdmin || isChairperson || isTreasurer) {
    return next();
  }

  req.flash(
    "error",
    "You do not have permission to access the financial dashboard.",
  );

  return res.redirect("/dashboard");
}
