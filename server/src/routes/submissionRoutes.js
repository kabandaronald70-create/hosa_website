import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import { requireVerified } from "../middleware/requireVerified.js"; // ← Added
import {
  showNewStoryForm,
  submitNewStory,
  showNewOpportunityForm,
  submitNewOpportunity,
  showMySubmissions,
} from "../controllers/submissionController.js";
import { env } from "../config/env.js";

const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => env.isDev,
  handler: (req, res) => {
    res
      .status(429)
      .type("text/plain")
      .send("Too many submissions. Please try again later.");
  },
});

const router = Router();

// Viewing your submissions only needs login (so they can see the empty state)
router.get("/dashboard/submissions", requireAuth, showMySubmissions);

// Submitting stories requires verification
router.get(
  "/dashboard/stories/new",
  requireAuth,
  requireVerified,
  showNewStoryForm,
);
router.post(
  "/dashboard/stories/new",
  requireAuth,
  requireVerified,
  submissionLimiter,
  submitNewStory,
);

// Submitting opportunities requires verification
router.get(
  "/dashboard/opportunities/new",
  requireAuth,
  requireVerified,
  showNewOpportunityForm,
);
router.post(
  "/dashboard/opportunities/new",
  requireAuth,
  requireVerified,
  submissionLimiter,
  submitNewOpportunity,
);

export default router;
