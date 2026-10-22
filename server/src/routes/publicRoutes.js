import { Router } from "express";
import {
  showAbout,
  showPrivacy,
  showTerms,
  showHelp,
  showContact,
  showMentorshipInfo,
} from "../controllers/publicPageController.js";
import {
  actionMarkAnnouncementRead,
  showAnnouncements,
} from "../controllers/announcementController.js";
import { query } from "../config/db.js";
import { listActiveAnnouncements } from "../models/announcementModel.js";
import { listDocuments } from "../models/documentModel.js";
import { requireAuth } from "../middleware/auth.js";
import { showBusinessDirectory } from "../controllers/businessController.js";

const router = Router();

// --- Home Page Route ---
router.get("/", async (req, res, next) => {
  try {
    const [memberCount, eventCount, jobCount, announcements] =
      await Promise.all([
        query(
          `SELECT COUNT(*)::int AS n FROM member_profiles WHERE public_visibility = TRUE`,
        ),
        query(
          `SELECT COUNT(*)::int AS n FROM events WHERE status = 'published' AND starts_at >= now()`,
        ),
        query(
          `SELECT COUNT(*)::int AS n FROM opportunities WHERE status = 'approved' AND (deadline IS NULL OR deadline >= CURRENT_DATE)`,
        ),
        listActiveAnnouncements(1),
      ]);

    res.render("public/home", {
      title: "HOSA — Highway Old Students' Association",
      layout: "layouts/public",
      stats: {
        members: memberCount.rows[0].n,
        events: eventCount.rows[0].n,
        jobs: jobCount.rows[0].n,
      },
      latestAnnouncement: announcements[0] || null,
    });
  } catch (err) {
    next(err);
  }
});

// --- Archive Route (Now fetches documents) ---
router.get("/archive", async (req, res, next) => {
  try {
    // Fetch past events
    const eventsResult = await query(
      `SELECT slug, title, starts_at, venue, description 
         FROM events 
        WHERE status = 'published' AND starts_at < now() 
        ORDER BY starts_at DESC LIMIT 20`,
    );

    // Fetch older stories
    const storiesResult = await query(
      `SELECT slug, title, excerpt, published_at, category
         FROM stories 
        WHERE status = 'published' 
        ORDER BY published_at ASC LIMIT 20`,
    );

    // Fetch documents (for logged-in users)
    const documents = await listDocuments();

    res.render("public/archive", {
      title: "Archive — HOSA",
      layout: "layouts/public",
      pastEvents: eventsResult.rows,
      stories: storiesResult.rows,
      documents: documents,
    });
  } catch (err) {
    next(err);
  }
});

// --- Static Public Pages ---
router.get("/about", showAbout);
router.get("/privacy", showPrivacy);
router.get("/announcements", showAnnouncements);
router.post("/announcements/:id/read", requireAuth, actionMarkAnnouncementRead);
router.get("/terms", showTerms);
router.get("/help", showHelp);
router.get("/contact", showContact);
router.get("/mentorship", showMentorshipInfo);
router.get("/businesses", showBusinessDirectory);

export default router;
