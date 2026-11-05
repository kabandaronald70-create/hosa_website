import { query } from "../config/db.js";

export function requireAuth(req, res, next) {
  if (!req.user) {
    if (
      req.path.startsWith("/api/") ||
      req.accepts(["html", "json"]) === "json"
    ) {
      return res.status(401).json({ error: "Authentication required." });
    }

    // Preserve intended destination for post-login redirect.
    const next_ = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${next_}`);
  }

  // Only users authorized to access regional reports receive the pending count.
  const isSuperAdmin = req.userRoles?.includes("super_admin");
  const isChairperson = req.leadershipRoles?.includes("Chairperson");
  const isProjectsManager = req.leadershipRoles?.includes("Projects Manager");

  if (isSuperAdmin || isChairperson || isProjectsManager) {
    query(`SELECT COUNT(*) FROM regional_reports WHERE status = 'pending'`)
      .then(({ rows }) => {
        res.locals.pendingRegionalReports = parseInt(rows[0].count, 10);
        next();
      })
      .catch(() => {
        // If the query fails, default to 0 without interrupting the request.
        res.locals.pendingRegionalReports = 0;
        next();
      });
  } else {
    res.locals.pendingRegionalReports = 0;
    next();
  }
}

export function requireGuest(req, res, next) {
  if (req.user) {
    return res.redirect("/dashboard");
  }

  next();
}

export function requireRole(...allowed) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      if (req.path.startsWith("/api/")) {
        return res.status(401).json({ error: "Authentication required." });
      }

      return res.redirect("/login");
    }

    const has = req.userRoles.some((r) => allowed.includes(r));

    if (!has) {
      if (req.path.startsWith("/api/")) {
        return res.status(403).json({ error: "Forbidden." });
      }

      return res.status(403).type("text/plain").send("403 Forbidden");
    }

    next();
  };
}

export function isAdmin(req) {
  return (
    req.userRoles?.some((r) => r === "admin" || r === "super_admin") ?? false
  );
}

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
