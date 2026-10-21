import { query } from "../config/db.js";

export function showReportForm(req, res) {
  const { type, id } = req.query;
  if (!["story", "opportunity"].includes(type) || !id) {
    return res.redirect("/");
  }
  res.render("public/report-form", {
    title: "Report Content — HOSA",
    type,
    id,
    layout: "layouts/public",
  });
}

export async function submitReport(req, res, next) {
  try {
    const { type, id, reason } = req.body;
    if (!["story", "opportunity"].includes(type) || !id || !reason) {
      req.flash("error", "Invalid report submission.");
      return res.redirect("back");
    }

    await query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason) 
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, type, id, reason],
    );

    req.flash("success", "Thank you. Our moderators will review this content.");
    res.redirect(type === "story" ? "/stories" : "/jobs");
  } catch (err) {
    next(err);
  }
}
