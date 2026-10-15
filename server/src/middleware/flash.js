/**
 * Minimal session-backed flash messages.
 *
 * Usage in a controller:
 *   req.flash('success', 'Welcome back!');
 *   req.flash('error', 'Invalid credentials.');
 *
 * The messages are written into the session AFTER the response finishes,
 * then rendered on the next request via res.locals.flash.
 */
export function flash(req, res, next) {
  const session = req.session;
  if (!session) return next();

  if (!session.flash) session.flash = {};

  // Accumulate messages in a local object; commit on finish.
  const pending = {};

  req.flash = function setFlash(type, message) {
    pending[type] = message;
  };

  res.on("finish", () => {
    // Session may have been destroyed (logout) or regenerated (login)
    // between when we set up this handler and when the response finished.
    // In either case, silently drop the pending flashes.
    if (!req.session || req.session !== session) return;
    if (Object.keys(pending).length === 0) return;
    if (!req.session.flash) req.session.flash = {};
    Object.assign(req.session.flash, pending);
  });

  // Expose any existing flashes to this request's views, then clear.
  res.locals.flash = { ...session.flash };
  session.flash = {};

  next();
}
