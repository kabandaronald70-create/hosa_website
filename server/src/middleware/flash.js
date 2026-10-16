/**
 * Session-backed flash messages.
 *
 * req.flash('success', 'Saved.') writes into req.session.flash immediately,
 * so express-session's autosave persists it to the store for the *next*
 * request. This is the standard pattern and works across redirects.
 */
export function flash(req, res, next) {
  if (!req.session) return next();

  if (!req.session.flash) req.session.flash = {};

  // Expose whatever is in the session to this request's views, then clear it.
  // These messages will NOT appear on the *next* request because we clear them.
  res.locals.flash = { ...req.session.flash };
  req.session.flash = {};

  // Write messages for the next request directly into the session.
  req.flash = function setFlash(type, message) {
    if (!req.session) return;
    if (!req.session.flash) req.session.flash = {};
    req.session.flash[type] = message;
  };

  next();
}
