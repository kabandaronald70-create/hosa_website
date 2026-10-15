import {
  getProfileByUserId,
  profileCompletion,
} from "../models/profileModel.js";

export async function showDashboard(req, res, next) {
  try {
    const profile = await getProfileByUserId(req.user.id);
    const completion = profileCompletion(profile);
    res.render("dashboard", {
      title: "Dashboard — HOSA",
      completion,
    });
  } catch (err) {
    next(err);
  }
}
