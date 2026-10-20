import { query } from "../config/db.js";
import {
  getProfileByUserId,
  profileCompletion,
} from "../models/profileModel.js";
import { listMyUpcomingRsvps } from "../models/rsvpModel.js";
import { listMyRequests } from "../models/mentorshipModel.js";

export async function showDashboard(req, res, next) {
  try {
    const [profile, rsvps, requests] = await Promise.all([
      getProfileByUserId(req.user.id),
      listMyUpcomingRsvps(req.user.id, 5),
      listMyRequests(req.user.id),
    ]);
    const completion = profileCompletion(profile);
    const activeMentorship =
      requests.received.filter((r) => r.status === "pending").length +
      requests.sent.filter((r) => ["pending", "accepted"].includes(r.status))
        .length;

    res.render("dashboard", {
      title: "Dashboard — HOSA",
      completion,
      rsvps,
      activeMentorship,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function showPendingApproval(req, res, next) {
  try {
    // Contact details for the site administrators, shown to unapproved members
    // so they can request approval. DISTINCT avoids duplicates when someone
    // holds more than one admin role.
    const result = await query(`
      SELECT DISTINCT
        u.email,
        mp.first_name,
        mp.last_name,
        mp.phone
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      LEFT JOIN member_profiles mp ON u.id = mp.user_id
      WHERE r.name IN ('admin', 'super_admin')
      AND u.status = 'active'
      ORDER BY mp.first_name ASC
    `);

    res.render("pending-approval", {
      title: "Pending Approval — HOSA",
      user: req.user,
      profile: req.profile,
      admins: result.rows,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}
