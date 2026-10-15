import {
  findUserById,
  getRolesForUser,
  getProfileForUser,
} from "../models/userModel.js";
import { logger } from "../utils/logger.js";

/**
 * Loads req.user, req.userRoles, req.profile from the session (if any).
 * Always runs. Never throws — a broken session just means "guest".
 */
export async function currentUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.currentUserRoles = [];
  res.locals.currentProfile = null;
  req.user = null;
  req.userRoles = [];
  req.profile = null;

  if (!req.session?.userId) return next();

  try {
    const user = await findUserById(req.session.userId);
    if (!user || user.status !== "active") {
      // Session points at a dead/inactive user — clear it.
      req.session.userId = null;
      return next();
    }
    const [roles, profile] = await Promise.all([
      getRolesForUser(user.id),
      getProfileForUser(user.id),
    ]);
    req.user = user;
    req.userRoles = roles;
    req.profile = profile;

    res.locals.currentUser = user;
    res.locals.currentUserRoles = roles;
    res.locals.currentProfile = profile;
    res.locals.isAuthenticated = true;
  } catch (err) {
    logger.error({ err }, "Failed to load current user; treating as guest");
  }
  next();
}
