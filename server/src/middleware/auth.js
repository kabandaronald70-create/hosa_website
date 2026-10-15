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
  next();
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
