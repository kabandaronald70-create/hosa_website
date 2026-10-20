export function requireApproved(req, res, next) {
  if (!req.user) {
    return res.redirect("/login");
  }

  if (!req.user.membership_approved_at) {
    return res.redirect("/pending-approval");
  }

  next();
}
