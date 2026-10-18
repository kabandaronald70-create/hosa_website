import { Router } from "express";
import {
  showAbout,
  showPrivacy,
  showTerms,
  showHelp,
  showContact,
  showMentorshipInfo,
} from "../controllers/publicPageController.js";
import { query } from "../config/db.js";

const router = Router();

// --- Home Page Route ---
router.get("/", async (req, res, next) => {
  try {
    // Fetch honest, verified stats for the home page
    const [memberCount, eventCount, jobCount] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS n FROM member_profiles WHERE public_visibility = TRUE`,
      ),
      query(
        `SELECT COUNT(*)::int AS n FROM events WHERE status = 'published' AND starts_at >= now()`,
      ),
      query(
        `SELECT COUNT(*)::int AS n FROM opportunities WHERE status = 'approved' AND (deadline IS NULL OR deadline >= CURRENT_DATE)`,
      ),
    ]);

    res.render("public/home", {
      title: "HOSA — Highway Old Students' Association",
      layout: "layouts/public",
      stats: {
        members: memberCount.rows[0].n,
        events: eventCount.rows[0].n,
        jobs: jobCount.rows[0].n,
      },
    });
  } catch (err) {
    next(err);
  }
});

// --- Static Public Pages ---
router.get("/about", showAbout);
router.get("/privacy", showPrivacy);
router.get("/terms", showTerms);
router.get("/help", showHelp);
router.get("/contact", showContact);
router.get("/mentorship", showMentorshipInfo);

export default router;
