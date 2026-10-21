import {
  listAnnouncements,
  listActiveAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  markAnnouncementRead,
} from "../models/announcementModel.js";
import { auditLog } from "../services/auditService.js";
import { logger } from "../utils/logger.js";

export async function showAnnouncements(req, res, next) {
  try {
    const announcements = await listActiveAnnouncements(20, req.user?.id);
    res.render("announcements/list", {
      title: "Announcements — HOSA",
      layout: "layouts/public",
      announcements,
    });
  } catch (err) {
    next(err);
  }
}

export async function actionMarkAnnouncementRead(req, res, next) {
  try {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(req.params.id)) {
      req.flash("error", "That announcement could not be found.");
      return res.redirect("/announcements");
    }

    const marked = await markAnnouncementRead(req.params.id, req.user.id);
    if (marked === null) {
      req.flash(
        "error",
        "Announcement read tracking is unavailable. Please try again later.",
      );
      return res.redirect("/announcements");
    }

    if (!marked) {
      req.flash("error", "That announcement is no longer available.");
      return res.redirect("/announcements");
    }

    req.flash("success", "Announcement marked as read.");
    res.redirect("/announcements");
  } catch (err) {
    next(err);
  }
}

export async function showAdminAnnouncements(req, res, next) {
  try {
    const announcements = await listAnnouncements(50);
    res.render("admin/announcements", {
      title: "Manage Announcements — Admin",
      layout: "layouts/app",
      announcements,
    });
  } catch (err) {
    next(err);
  }
}

export async function submitAnnouncement(req, res, next) {
  try {
    const { title, body, pinned } = req.body;

    if (!title || !body) {
      req.flash("error", "Title and body are required.");
      return res.redirect("/admin/announcements");
    }

    const created = await createAnnouncement({
      title: title.trim(),
      body: body.trim(),
      pinned: pinned === "on",
      authorId: req.user.id,
    });

    await auditLog({
      req,
      action: "announcement.create",
      targetType: "announcement",
      targetId: created.id,
      metadata: { title: created.title },
    });

    req.flash("success", "Announcement created.");
    res.redirect("/admin/announcements");
  } catch (err) {
    logger.error({ err }, "Failed to create announcement");
    next(err);
  }
}

export async function removeAnnouncement(req, res, next) {
  try {
    await deleteAnnouncement(req.params.id);
    await auditLog({
      req,
      action: "announcement.delete",
      targetType: "announcement",
      targetId: req.params.id,
    });
    req.flash("success", "Announcement deleted.");
    res.redirect("/admin/announcements");
  } catch (err) {
    next(err);
  }
}
