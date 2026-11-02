import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { requireOutreachOfficer } from "../middleware/requireOutreachOfficer.js";
import {
  showRegionalDashboard,
  showRegionalProposalForm,
  actionSubmitRegionalProposal,
} from "../controllers/regionalController.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get(
  "/regional/dashboard",
  requireAuth,
  requireOutreachOfficer,
  showRegionalDashboard,
);
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

export default router;
