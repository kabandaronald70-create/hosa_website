import {
  listMyNotifications,
  countUnread,
  markRead,
  markAllRead,
} from "../models/notificationModel.js";

export async function showNotifications(req, res, next) {
  try {
    const [items, unread] = await Promise.all([
      listMyNotifications(req.user.id, { limit: 100 }),
      countUnread(req.user.id),
    ]);
    res.render("notifications/list", {
      title: "Notifications — HOSA",
      items,
      unread,
      layout: "layouts/app", // ← Added
    });
  } catch (err) {
    next(err);
  }
}

export async function actionMarkRead(req, res, next) {
  try {
    await markRead(req.user.id, req.params.id);
    res.redirect("/notifications");
  } catch (err) {
    next(err);
  }
}

export async function actionMarkAllRead(req, res, next) {
  try {
    await markAllRead(req.user.id);
    req.flash("success", "All notifications marked as read.");
    res.redirect("/notifications");
  } catch (err) {
    next(err);
  }
}

export async function apiListMyNotifications(req, res, next) {
  try {
    const unreadOnly =
      req.query.unread_only === "1" || req.query.unread_only === "true";
    const [items, unread] = await Promise.all([
      listMyNotifications(req.user.id, { unreadOnly, limit: 50 }),
      countUnread(req.user.id),
    ]);
    res.json({ data: items, unread });
  } catch (err) {
    next(err);
  }
}
