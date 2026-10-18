export function requireVerified(req, res, next) {
  if (!req.user) {
    return res.redirect("/login");
  }

  if (!req.user.email_verified_at) {
    req.flash(
      "error",
      "You must verify your email address to access this page.",
    );
    return res.redirect("/verify-required");
  }

  next();
}
