export function requireRegionalReportsAccess(req, res, next) {
  if (!req.user) {
    const nextUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${nextUrl}`);
  }

  const isSuperAdmin = req.userRoles?.includes("super_admin");
  const isChairperson = req.leadershipRoles?.includes("Chairperson");
  const isProjectsManager = req.leadershipRoles?.includes("Projects Manager");

  if (isSuperAdmin || isChairperson || isProjectsManager) {
    return next();
  }

  return res
    .status(403)
    .type("text/plain")
    .send(
      "403 Forbidden: You do not have permission to access regional reports.",
    );
}
