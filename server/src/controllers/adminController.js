import { getAdminCounts, getRecentAudits } from "../models/adminModel.js";

export async function showAdminOverview(req, res, next) {
  try {
    const [counts, recentAudits] = await Promise.all([
      getAdminCounts(),
      getRecentAudits(10),
    ]);
    res.render("admin/overview", {
      title: "Admin — HOSA",
      counts,
      recentAudits,
    });
  } catch (err) {
    next(err);
  }
}
