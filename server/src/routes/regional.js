import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { csrfCheck } from "../middleware/csrf.js";
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
  actionDownloadRegionalReportAttachment,
} from "../controllers/regionalController.js";

const router = Router();

// Regional uploads are processed in memory and limited to one file.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
    fields: 10,
    parts: 11,
  },
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
  csrfCheck,
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
  csrfCheck,
  actionSubmitReport,
);

router.get(
  "/regional/reports/:id/attachment",
  requireAuth,
  requireOutreachOfficer,
  actionDownloadRegionalReportAttachment,
);

// --- Edit and Delete Reports ---
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
