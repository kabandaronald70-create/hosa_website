export function requireOutreachOfficer(req, res, next) {
  if (!req.user) {
    return res.redirect("/login");
  }

  const isOutreach = (req.leadershipRoles || []).some((role) => {
    const normalized = String(role || "").trim().toLowerCase();

    return (
      /^outreach officer\s*\((eastern|central|western|northern)\)$/.test(normalized) ||
      normalized === "regional_outreach_officer"
    );
  });

  if (!isOutreach) {
    req.flash(
      "error",
      "You do not have permission to access the Regional Portal.",
    );
    return res.redirect("/dashboard");
  }

  next();
}
