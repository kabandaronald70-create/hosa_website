import {
  listAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from "../models/announcementModel.js";
import { auditLog } from "../services/auditService.js";
import { logger } from "../utils/logger.js";

export async function showAnnouncements(req, res, next) {
  try {
    const announcements = await listAnnouncements(20);
    res.render("announcements/list", {
      title: "Announcements — HOSA",
      layout: "layouts/public", // Or layouts/app depending on where you link it
      announcements,
    });
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
