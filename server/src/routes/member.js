import { Router } from "express";
import {
  showDashboard,
  showPendingApproval,
} from "../controllers/memberController.js";
import {
  showReportForm,
  submitReport,
} from "../controllers/reportController.js";
import {
  showMyBusinesses,
  actionCreateBusiness,
  showEditBusinessForm,
  actionUpdateBusiness,
} from "../controllers/businessController.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadLogo } from "../middleware/upload.js";
import {
  showMyNetworkRequests,
  actionCreateRequest,
  actionCloseRequest,
} from "../controllers/networkController.js";
import {
  showMyContributions,
  actionSubmitContribution,
} from "../controllers/financeController.js";

const router = Router();

// Dashboard access is gated by login + membership approval.
router.get("/dashboard", requireAuth, showDashboard);

// Pending approval page
router.get("/pending-approval", requireAuth, showPendingApproval);

// Report flow
router.get("/report", requireAuth, showReportForm);
router.post("/report", requireAuth, submitReport);

// Business Directory (Member Dashboard)
router.get("/dashboard/businesses", requireAuth, showMyBusinesses);
router.post(
  "/dashboard/businesses",
  requireAuth,
  uploadLogo,
  actionCreateBusiness,
);

// Edit Business Routes
router.get("/dashboard/businesses/:id/edit", requireAuth, showEditBusinessForm);
router.post(
  "/dashboard/businesses/:id/edit",
  requireAuth,
  uploadLogo,
  actionUpdateBusiness,
);
router.get("/dashboard/business-network", requireAuth, showMyNetworkRequests);
router.post("/dashboard/business-network", requireAuth, actionCreateRequest);
router.post(
  "/dashboard/business-network/:id/close",
  requireAuth,
  actionCloseRequest,
);

// Contributions
router.get("/dashboard/contributions", requireAuth, showMyContributions);
router.post("/dashboard/contributions", requireAuth, actionSubmitContribution);

export default router;
