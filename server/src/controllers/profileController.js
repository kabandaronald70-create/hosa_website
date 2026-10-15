import {
  getProfileByUserId,
  profileCompletion,
} from "../models/profileModel.js";
import {
  saveProfile,
  changePassword,
  invalidateOtherSessions,
} from "../services/profileService.js";
import {
  uploadUserAvatar,
  deleteUserAvatar,
  signAvatarPath,
} from "../services/avatarService.js";
import {
  profileSchema,
  passwordChangeSchema,
  flattenZodError,
} from "../validators/profileValidators.js";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Profile edit
// ---------------------------------------------------------------------------

export async function showEditProfile(req, res, next) {
  try {
    const profile = await getProfileByUserId(req.user.id);
    res.render("profile/edit", {
      title: "Edit profile — HOSA",
      values: profile || {},
      fieldErrors: {},
    });
  } catch (err) {
    next(err);
  }
}

export async function submitEditProfile(req, res, next) {
  const parsed = profileSchema.safeParse(req.body);

  if (!parsed.success) {
    const { fieldErrors } = flattenZodError(parsed.error);
    return res.status(400).render("profile/edit", {
      title: "Edit profile — HOSA",
      values: { ...req.body, __from_form: true },
      fieldErrors,
    });
  }

  try {
    await saveProfile(req.user.id, parsed.data);
    req.flash("success", "Profile updated.");
    res.redirect("/dashboard");
  } catch (err) {
    logger.error({ err }, "Profile update failed");
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Password change
// ---------------------------------------------------------------------------

export async function showChangePassword(req, res) {
  res.render("profile/password", {
    title: "Change password — HOSA",
    fieldErrors: {},
  });
}

export async function submitChangePassword(req, res, next) {
  const parsed = passwordChangeSchema.safeParse(req.body);

  if (!parsed.success) {
    const { fieldErrors } = flattenZodError(parsed.error);
    return res.status(400).render("profile/password", {
      title: "Change password — HOSA",
      fieldErrors,
    });
  }

  try {
    await changePassword(req.user.id, parsed.data);

    // Log out other devices, keep the current session.
    const removed = await invalidateOtherSessions(req.user.id, req.sessionID);

    req.flash(
      "success",
      removed > 0
        ? `Password changed. Signed out ${removed} other session${removed === 1 ? "" : "s"}.`
        : "Password changed.",
    );
    res.redirect("/dashboard");
  } catch (err) {
    if (err.code === "WRONG_PASSWORD") {
      return res.status(401).render("profile/password", {
        title: "Change password — HOSA",
        fieldErrors: { current_password: "Current password is incorrect." },
      });
    }
    logger.error({ err }, "Password change failed");
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Profile completion helper (used by dashboard)
// ---------------------------------------------------------------------------

export async function dashboardProfileSummary(userId) {
  const profile = await getProfileByUserId(userId);
  return { profile, completion: profileCompletion(profile) };
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      req.flash("error", "Choose an image file to upload.");
      return res.redirect("/dashboard/profile");
    }
    await uploadUserAvatar(req.user.id, req.file.buffer);
    req.flash("success", "Avatar updated.");
    res.redirect("/dashboard/profile");
  } catch (err) {
    if (err.status && err.status < 500) {
      req.flash("error", err.message);
      return res.redirect("/dashboard/profile");
    }
    logger.error({ err }, "Avatar upload failed");
    next(err);
  }
}

export async function removeAvatar(req, res, next) {
  try {
    await deleteUserAvatar(req.user.id);
    req.flash("success", "Avatar removed.");
    res.redirect("/dashboard/profile");
  } catch (err) {
    logger.error({ err }, "Avatar removal failed");
    next(err);
  }
}

export async function serveAvatar(req, res, next) {
  try {
    const isMe = req.params.userId === "me" || req.path.endsWith("/avatar/me");
    const targetId = isMe ? req.user?.id : req.params.userId;

    if (!targetId) {
      return res.status(401).type("text/plain").send("Not authenticated");
    }

    const profile = await getProfileByUserId(targetId);
    if (!profile) {
      return res.status(404).type("text/plain").send("Not found");
    }

    // If asking for someone else, require public visibility.
    if (targetId !== req.user?.id && profile.public_visibility !== true) {
      return res.status(404).type("text/plain").send("Not found");
    }

    if (!profile.avatar_path) {
      return res.status(404).type("text/plain").send("No avatar");
    }

    const url = await signAvatarPath(profile.avatar_path);
    if (!url) {
      return res.status(502).type("text/plain").send("Storage error");
    }

    res.set("Cache-Control", "private, max-age=30");
    res.redirect(302, url);
  } catch (err) {
    next(err);
  }
}
