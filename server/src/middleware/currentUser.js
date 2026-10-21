import {
  findUserById,
  getRolesForUser,
  getProfileForUser,
} from "../models/userModel.js";
import { logger } from "../utils/logger.js";
import { countUnread } from "../models/notificationModel.js";
import { countAnnouncementBadge } from "../models/announcementModel.js";

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
    // 2. If no session, we are done (user is a guest)
    if (!req.session?.userId) {
      res.locals.activeAnnouncements = await countAnnouncementBadge();
      return next();
    }

    // 3. Load user from DB
    const user = await findUserById(req.session.userId);

    // FIXED: Only block suspended or deactivated users.
    // Allow 'active' AND 'pending_approval' to stay logged in.
    if (!user || ["suspended", "deactivated"].includes(user.status)) {
      // Session points at a dead/inactive user — clear it.
      req.session.userId = null;
      res.locals.activeAnnouncements = await countAnnouncementBadge();
      return next();
    }

    // 4. Fetch roles, profile, and unread notifications
    const [roles, profile, unread, unreadAnnouncements] = await Promise.all([
      getRolesForUser(user.id),
      getProfileForUser(user.id),
      countUnread(user.id),
      countAnnouncementBadge(user.id),
    ]);

    req.user = user;
    req.userRoles = roles;
    req.profile = profile;

    res.locals.currentUser = user;
    res.locals.currentUserRoles = roles;
    res.locals.currentProfile = profile;
    res.locals.isAuthenticated = true;
    res.locals.unreadNotifications = unread;
    res.locals.activeAnnouncements = unreadAnnouncements;
  } catch (err) {
    logger.error({ err }, "Failed to load current user; treating as guest");
  }

  next();
}
