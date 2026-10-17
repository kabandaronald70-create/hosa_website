import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
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

router.get("/dashboard/submissions", requireAuth, showMySubmissions);

router.get("/dashboard/stories/new", requireAuth, showNewStoryForm);
router.post(
  "/dashboard/stories/new",
  requireAuth,
  submissionLimiter,
  submitNewStory,
);

router.get("/dashboard/opportunities/new", requireAuth, showNewOpportunityForm);
router.post(
  "/dashboard/opportunities/new",
  requireAuth,
  submissionLimiter,
  submitNewOpportunity,
);

export default router;
