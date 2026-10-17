import { Router } from "express";
import rateLimit from "express-rate-limit";
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

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => {
    res
      .status(429)
      .json({ error: "Too many requests. Please try again later." });
  },
});

router.use("/api", apiLimiter);

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
