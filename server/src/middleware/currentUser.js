import {
  findUserById,
  getRolesForUser,
  getProfileForUser,
} from "../models/userModel.js";
import { logger } from "../utils/logger.js";
import { countUnread } from "../models/notificationModel.js";
import { countAnnouncementBadge } from "../models/announcementModel.js";
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
  res.locals.currentLeadershipRoles = [];
  req.user = null;
  req.userRoles = [];
  req.profile = null;
  req.leadershipRoles = []; // <-- ADD THIS DEFAULT

  try {
    // 2. If no session, we are done (user is a guest)
    if (!req.session?.userId) {
      res.locals.activeAnnouncements = await countAnnouncementBadge();
      return next();
    }

    // 3. Load user from DB
    const user = await findUserById(req.session.userId);

    if (!user || ["suspended", "deactivated"].includes(user.status)) {
      req.session.userId = null;
      res.locals.activeAnnouncements = await countAnnouncementBadge();
      return next();
    }

    // 4. Fetch roles, profile, leadership roles, and unread counts
    const [roles, profile, unread, unreadAnnouncements, leadershipRes] =
      await Promise.all([
        getRolesForUser(user.id),
        getProfileForUser(user.id),
        countUnread(user.id),
        countAnnouncementBadge(user.id),
        query(
          `SELECT office_title FROM leadership_roles WHERE user_id = $1 AND status = 'active'`,
          [user.id],
        ),
      ]);

    const leadershipRoles = leadershipRes.rows.map((r) => r.office_title);

    req.user = user;
    req.userRoles = roles;
    req.profile = profile;
    req.leadershipRoles = leadershipRoles; // <-- ADD THIS

    res.locals.currentUser = user;
    res.locals.currentUserRoles = roles;
    res.locals.currentProfile = profile;
    res.locals.isAuthenticated = true;
    res.locals.unreadNotifications = unread;
    res.locals.activeAnnouncements = unreadAnnouncements;
    res.locals.currentLeadershipRoles = leadershipRoles;
  } catch (err) {
    logger.error({ err }, "Failed to load current user; treating as guest");
  }

  next();
}
