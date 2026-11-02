export function requireOutreachOfficer(req, res, next) {
  if (!req.user) {
    return res.redirect("/login");
  }

  const isOutreach = req.leadershipRoles?.some((role) =>
    role.startsWith("Outreach Officer"),
  );

  if (!isOutreach) {
    req.flash(
      "error",
      "You do not have permission to access the Regional Portal.",
    );
    return res.redirect("/dashboard");
  }

  next();
}
