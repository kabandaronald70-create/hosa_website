import { Router } from "express";
import {
  showDashboard,
  showPendingApproval,
} from "../controllers/memberController.js";
import {
  showReportForm,
  submitReport,
} from "../controllers/reportController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Dashboard access is gated by login + membership approval.
// The approval check itself is applied centrally in routes/index.js
// (router.use("/dashboard", ...)).
router.get("/dashboard", requireAuth, showDashboard);

// Pending approval page — only login is required (never gated by approval,
// otherwise unapproved members would loop back onto this page).
router.get("/pending-approval", requireAuth, showPendingApproval);

// Report flow — any signed-in user can report content.
router.get("/report", requireAuth, showReportForm);
router.post("/report", requireAuth, submitReport);

export default router;
