import { Router } from "express";
import {
  showDashboard,
  showPendingApproval,
} from "../controllers/memberController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Dashboard access is gated by login + membership approval.
// The approval check itself is applied centrally in routes/index.js
// (router.use("/dashboard", ...)).
router.get("/dashboard", requireAuth, showDashboard);

// Pending approval page — only login is required (never gated by approval,
// otherwise unapproved members would loop back onto this page).
router.get("/pending-approval", requireAuth, showPendingApproval);

export default router;
