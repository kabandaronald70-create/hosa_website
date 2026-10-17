import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getDirectory,
  getDirectoryMember,
  getEvents,
  getEvent,
  getStories,
  getOpportunities,
} from "../controllers/apiPublicController.js";
import {
  getMe,
  getMySaved,
  getMyRsvps,
} from "../controllers/apiMeController.js";
import {
  postSaved,
  deleteSaved,
  postRsvp,
  deleteRsvpAction,
} from "../controllers/apiActionController.js";

const router = Router();

router.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "hosa-api",
    timestamp: new Date().toISOString(),
  });
});

// Public reads
router.get("/api/directory", getDirectory);
router.get("/api/directory/:id", getDirectoryMember);
router.get("/api/events", getEvents);
router.get("/api/events/:slug", getEvent);
router.get("/api/stories", getStories);
router.get("/api/opportunities", getOpportunities);

// Current user (works for guests too)
router.get("/api/me", getMe);

// Authenticated interactions
router.get("/api/me/saved", requireAuth, getMySaved);
router.get("/api/me/rsvps", requireAuth, getMyRsvps);
router.post("/api/saved", requireAuth, postSaved);
router.delete("/api/saved/:id", requireAuth, deleteSaved);
router.post("/api/rsvp/:slug", requireAuth, postRsvp);
router.delete("/api/rsvp/:slug", requireAuth, deleteRsvpAction);

export default router;
