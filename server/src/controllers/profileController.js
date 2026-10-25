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
import { query } from "../config/db.js";
import { findUserById } from "../models/userModel.js";
import { verifyPassword } from "../services/passwordService.js";

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
      layout: "layouts/app", // ← Added layout
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
      layout: "layouts/app", // ← Added layout
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
    layout: "layouts/app", // ← Added layout
  });
}

export async function submitChangePassword(req, res, next) {
  const parsed = passwordChangeSchema.safeParse(req.body);

  if (!parsed.success) {
    const { fieldErrors } = flattenZodError(parsed.error);
    return res.status(400).render("profile/password", {
      title: "Change password — HOSA",
      fieldErrors,
      layout: "layouts/app", // ← Added layout
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
        layout: "layouts/app", // ← Added layout
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
    // BUT allow guests to see public avatars (no req.user check).
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

    // Cache for longer since avatars don't change often
    res.set("Cache-Control", "public, max-age=3600");
    res.redirect(302, url);
  } catch (err) {
    next(err);
  }
}

export async function exportMyData(req, res, next) {
  try {
    const userId = req.user.id;

    // Fetch data
    const userData = await query(
      `SELECT email, status, created_at, last_login_at FROM users WHERE id = $1`,
      [userId],
    );

    const profileData = await query(
      `SELECT * FROM member_profiles WHERE user_id = $1`,
      [userId],
    );

    const savedItems = await query(
      `SELECT item_type, item_id, created_at FROM saved_items WHERE user_id = $1`,
      [userId],
    );

    const rsvps = await query(
      `SELECT e.title, r.status, r.created_at FROM event_rsvps r JOIN events e ON e.id = r.event_id WHERE r.user_id = $1`,
      [userId],
    );

    const user = userData.rows[0];
    const profile = profileData.rows[0];

    // Helper to format CSV values (wrap in quotes, escape quotes)
    const csvVal = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    // Build the CSV rows
    let csv = "Section,Field,Value\n";

    // Account section
    csv += `${csvVal("Account")},${csvVal("Email")},${csvVal(user.email)}\n`;
    csv += `${csvVal("Account")},${csvVal("Status")},${csvVal(user.status)}\n`;
    csv += `${csvVal("Account")},${csvVal("Member Since")},${csvVal(user.created_at)}\n`;

    // Profile section
    csv += `${csvVal("Profile")},${csvVal("First Name")},${csvVal(profile.first_name)}\n`;
    csv += `${csvVal("Profile")},${csvVal("Last Name")},${csvVal(profile.last_name)}\n`;
    csv += `${csvVal("Profile")},${csvVal("Graduation Year")},${csvVal(profile.graduation_year)}\n`;
    csv += `${csvVal("Profile")},${csvVal("Profession")},${csvVal(profile.profession)}\n`;
    csv += `${csvVal("Profile")},${csvVal("Organization")},${csvVal(profile.organization)}\n`;
    csv += `${csvVal("Profile")},${csvVal("District")},${csvVal(profile.district)}\n`;
    csv += `${csvVal("Profile")},${csvVal("Country")},${csvVal(profile.country_code)}\n`;
    csv += `${csvVal("Profile")},${csvVal("Biography")},${csvVal(profile.biography)}\n`;

    // Saved items section
    csv += `\n${csvVal("Saved Items")},${csvVal("Type")},${csvVal("Item ID")},${csvVal("Date Saved")}\n`;
    if (savedItems.rows.length === 0) {
      csv += `${csvVal("Saved Items")},${csvVal("None")},,\n`;
    } else {
      savedItems.rows.forEach((item) => {
        csv += `${csvVal("Saved Item")},${csvVal(item.item_type)},${csvVal(item.item_id)},${csvVal(item.created_at)}\n`;
      });
    }

    // RSVPs section
    csv += `\n${csvVal("Event RSVPs")},${csvVal("Event")},${csvVal("Status")},${csvVal("Date")}\n`;
    if (rsvps.rows.length === 0) {
      csv += `${csvVal("RSVPs")},${csvVal("None")},,\n`;
    } else {
      rsvps.rows.forEach((rsvp) => {
        csv += `${csvVal("RSVP")},${csvVal(rsvp.title)},${csvVal(rsvp.status)},${csvVal(rsvp.created_at)}\n`;
      });
    }

    // Send as CSV
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="hosa-my-data.csv"',
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

export async function deleteMyAccount(req, res, next) {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    // Verify password before deletion
    const user = await findUserById(userId);
    const isValid = await verifyPassword(user.password_hash, password);

    if (!isValid) {
      req.flash("error", "Incorrect password. Account not deleted.");
      return res.redirect("/dashboard/password"); // Or wherever the form is
    }

    // Because of ON DELETE CASCADE in the DB, deleting the user removes
    // their profile, saved items, RSVPs, and sessions automatically.
    await query(`DELETE FROM users WHERE id = $1`, [userId]);

    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie("hosa.sid");
      res.redirect("/?deleted=true");
    });
  } catch (err) {
    next(err);
  }
}
