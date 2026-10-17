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
    });
  } catch (err) {
    next(err);
  }
}
