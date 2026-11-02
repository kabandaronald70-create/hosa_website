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
  showPublicProjects,
  showProjectDetails,
} from "../controllers/projectController.js";
import { requireAuth } from "../middleware/auth.js";

import { showArchive } from "../controllers/publicEjsController.js";
import {
  actionMarkAnnouncementRead,
  showAnnouncements,
} from "../controllers/announcementController.js";
import { query } from "../config/db.js";
import { listActiveAnnouncements } from "../models/announcementModel.js";
import { showBusinessDirectory } from "../controllers/businessController.js";
import {
  downloadDocumentFile,
  viewDocumentFile,
} from "../controllers/documentController.js";
import { showNetworkBoard } from "../controllers/networkController.js";

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

router.get("/archive", showArchive);
router.get("/documents/:id/view", requireAuth, viewDocumentFile);
router.get("/documents/:id/download", requireAuth, downloadDocumentFile);

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
router.get("/business-network", requireAuth, showNetworkBoard);

router.get("/projects", requireAuth, showPublicProjects);
router.get("/projects/:id", requireAuth, showProjectDetails);

export default router;
