import {
  findUserById,
  getRolesForUser,
  getProfileForUser,
} from "../models/userModel.js";
import { logger } from "../utils/logger.js";
import { countUnread } from "../models/notificationModel.js";
import { query } from "../config/db.js";

/**
 * Loads req.user, req.userRoles, req.profile from the session (if any).
 * Always runs. Never throws — a broken session just means "guest".
 */
export async function currentUser(req, res, next) {
  // Defaults for guests
  res.locals.currentUser = null;
  res.locals.currentUserRoles = [];
  res.locals.currentProfile = null;
  res.locals.isAuthenticated = false;
  req.user = null;
  req.userRoles = [];
  req.profile = null;

  try {
    // 1. Fetch active announcement count (for everyone, even guests)
    const { rows: annCount } = await query(
      `SELECT COUNT(*)::int AS n FROM announcements`,
    );
    res.locals.activeAnnouncements = annCount[0]?.n || 0;

    // 2. If no session, we are done (user is a guest)
    if (!req.session?.userId) {
      return next();
    }

    // 3. Load user from DB
    const user = await findUserById(req.session.userId);
    if (!user || user.status !== "active") {
      // Session points at a dead/inactive user — clear it.
      req.session.userId = null;
      return next();
    }

    // 4. Fetch roles, profile, and unread notifications
    const [roles, profile, unread] = await Promise.all([
      getRolesForUser(user.id),
      getProfileForUser(user.id),
      countUnread(user.id),
    ]);

    req.user = user;
    req.userRoles = roles;
    req.profile = profile;

    res.locals.currentUser = user;
    res.locals.currentUserRoles = roles;
    res.locals.currentProfile = profile;
    res.locals.isAuthenticated = true;
    res.locals.unreadNotifications = unread;
  } catch (err) {
    logger.error({ err }, "Failed to load current user; treating as guest");
  }

  next();
}
