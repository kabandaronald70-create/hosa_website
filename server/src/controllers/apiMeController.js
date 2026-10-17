import { listMySavedItems } from "../models/savedItemModel.js";
import { listMyUpcomingRsvps } from "../models/rsvpModel.js";

/**
 * GET /api/me
 * Returns the current user, or null for guests.
 * Includes roles so the SPA can conditionally show admin-only UI.
 */
export function getMe(req, res) {
  if (!req.user) {
    return res.json({ user: null });
  }
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      roles: req.userRoles || [],
      displayName:
        req.profile?.display_name ||
        `${req.profile?.first_name || ""} ${req.profile?.last_name || ""}`.trim() ||
        null,
      avatarUrl: req.profile?.avatar_path ? `/dashboard/avatar/me` : null,
    },
  });
}

export async function getMySaved(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  try {
    const items = await listMySavedItems(req.user.id);
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
}

export async function getMyRsvps(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  try {
    const rsvps = await listMyUpcomingRsvps(req.user.id, 100);
    const bySlug = {};
    for (const r of rsvps) bySlug[r.slug] = r.status;
    res.json({ data: bySlug });
  } catch (err) {
    next(err);
  }
}
