import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { requireOutreachOfficer } from "../middleware/requireOutreachOfficer.js";
import {
  showRegionalDashboard,
  showRegionalProposalForm,
  actionSubmitRegionalProposal,
  showRegionalReports,
  showNewReportForm,
  actionSubmitReport,
  showEditReportForm,
  actionUpdateReport,
  actionDeleteReport,
} from "../controllers/regionalController.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// --- Regional Dashboard ---
router.get(
  "/regional/dashboard",
  requireAuth,
  requireOutreachOfficer,
  showRegionalDashboard,
);

// --- Regional Proposals ---
router.get(
  "/regional/proposals/new",
  requireAuth,
  requireOutreachOfficer,
  showRegionalProposalForm,
);
router.post(
  "/regional/proposals",
  requireAuth,
  requireOutreachOfficer,
  upload.single("image"),
  actionSubmitRegionalProposal,
);

// --- Regional Reports ---
router.get(
  "/regional/reports",
  requireAuth,
  requireOutreachOfficer,
  showRegionalReports,
);
router.get(
  "/regional/reports/new",
  requireAuth,
  requireOutreachOfficer,
  showNewReportForm,
);
router.post(
  "/regional/reports",
  requireAuth,
  requireOutreachOfficer,
  upload.single("file"),
  actionSubmitReport,
);

// Edit & Delete Routes
router.get(
  "/regional/reports/:id/edit",
  requireAuth,
  requireOutreachOfficer,
  showEditReportForm,
);
router.post(
  "/regional/reports/:id/edit",
  requireAuth,
  requireOutreachOfficer,
  actionUpdateReport,
);
router.post(
  "/regional/reports/:id/delete",
  requireAuth,
  requireOutreachOfficer,
  actionDeleteReport,
);

export default router;
