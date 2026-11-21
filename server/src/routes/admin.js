import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { csrfCheck } from "../middleware/csrf.js";
import { requireFinanceAccess } from "../middleware/requireFinanceAccess.js";
import { requireRegionalReportsAccess } from "../middleware/requireRegionalReportsAccess.js";

import {
  showPendingBusinesses,
  actionApproveBusiness,
  actionRejectBusiness,
  actionToggleFeatured,
} from "../controllers/businessController.js";

import { showAnalyticsDashboard } from "../controllers/analyticsController.js";

import {
  showAdminProjects,
  showAdminProjectDetail,
  actionCreateProject,
  actionUpdateProjectStatus,
  actionCreateMilestone,
  actionUpdateMilestoneStatus,
  actionUploadProjectFile,
  actionUpdateProject,
  actionDeleteProject,
  actionUpdateFundsRaised,
  showProjectApprovalQueue,
  showProjectProposalReview,
  actionDecideProjectProposal,
} from "../controllers/projectController.js";

import {
  showAdminAnnouncements,
  submitAnnouncement,
  removeAnnouncement,
} from "../controllers/announcementController.js";

import {
  showAdminOverview,
  showMembersList,
  showMemberDetail,
  actionVerifyMember,
  actionUnverifyMember,
  actionSuspendMember,
  actionReactivateMember,
  showModerationQueue,
  actionApproveStory,
  actionRejectStory,
  actionApproveOpportunity,
  actionRejectOpportunity,
  showEventsList,
  showEventDetail,
  showNewEventForm,
  actionCreateEvent,
  showEditEventForm,
  actionUpdateEvent,
  actionSetEventStatus,
  actionApproveMembership,
  showAuditLog,
  showAuditDetail,
  exportAuditCsv,
  showReportsList,
  actionDismissReport,
  actionResolveReport,
  actionDeleteReportedContent,
  showLeadershipDashboard,
  actionCreateLeadershipRole,
  actionUpdateLeadershipRole,
  actionDeleteLeadershipRole,
  showRegionalReportsAdmin,
  actionMarkRegionalReportReviewed,
  actionDownloadRegionalReportAttachmentAdmin,
} from "../controllers/adminController.js";

import {
  showAdminCampaigns,
  actionCreateCampaign,
  actionToggleCampaignBusiness,
  actionUpdateCampaign,
  actionDeleteCampaign,
} from "../controllers/campaignController.js";

import {
  showFinanceDashboard,
  actionVerifyContribution,
  actionRejectContribution,
  showFinanceContributionProof,
  actionCreateExpense,
  actionUpdateExpenseStatus,
  actionUpdateExpense,
  actionDeleteExpense,
  actionExportContributions,
  actionExportAllExpenses,
  actionExportSingleExpense,
} from "../controllers/financeController.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// General admin access restriction.
//
// Finance and regional-report routes have their own dedicated
// authentication and authorization middleware.
router.use("/admin", (req, res, next) => {
  const isRegionalReportsRoute =
    req.path === "/regional-reports" ||
    req.path.startsWith("/regional-reports/");

  const isFinanceRoute =
    req.path === "/finance" || req.path.startsWith("/finance/");

  if (isRegionalReportsRoute || isFinanceRoute) {
    return next();
  }

  return requireRole("admin", "super_admin", "moderator")(req, res, next);
});

router.get("/admin", showAdminOverview);

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

router.get("/admin/members", showMembersList);
router.get("/admin/members/:id", showMemberDetail);
router.post("/admin/members/:id/verify", actionVerifyMember);
router.post("/admin/members/:id/unverify", actionUnverifyMember);
router.post("/admin/members/:id/suspend", actionSuspendMember);
router.post("/admin/members/:id/reactivate", actionReactivateMember);
router.post("/admin/members/:id/approve-membership", actionApproveMembership);

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

router.get("/admin/moderation", showModerationQueue);
router.post("/admin/moderation/stories/:id/approve", actionApproveStory);
router.post("/admin/moderation/stories/:id/reject", actionRejectStory);
router.post(
  "/admin/moderation/opportunities/:id/approve",
  actionApproveOpportunity,
);
router.post(
  "/admin/moderation/opportunities/:id/reject",
  actionRejectOpportunity,
);

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

router.get("/admin/events", showEventsList);
router.get("/admin/events/new", showNewEventForm);
router.post("/admin/events/new", actionCreateEvent);
router.get("/admin/events/:id", showEventDetail);
router.get("/admin/events/:id/edit", showEditEventForm);
router.post("/admin/events/:id/update", actionUpdateEvent);
router.post("/admin/events/:id/status", actionSetEventStatus);

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

router.get("/admin/audit", showAuditLog);
router.get("/admin/audit/export.csv", exportAuditCsv);
router.get("/admin/audit/:id", showAuditDetail);

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

router.get("/admin/announcements", showAdminAnnouncements);
router.post("/admin/announcements", submitAnnouncement);
router.post("/admin/announcements/:id/delete", removeAnnouncement);

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

router.get(
  "/admin/reports",
  requireRole("admin", "super_admin"),
  showReportsList,
);
router.post(
  "/admin/reports/:id/dismiss",
  requireRole("admin", "super_admin"),
  actionDismissReport,
);
router.post(
  "/admin/reports/:id/resolve",
  requireRole("admin", "super_admin"),
  actionResolveReport,
);
router.post(
  "/admin/reports/:id/delete-content",
  requireRole("admin", "super_admin"),
  actionDeleteReportedContent,
);

// ---------------------------------------------------------------------------
// Leadership & Governance
// ---------------------------------------------------------------------------

router.get(
  "/admin/leadership",
  requireRole("super_admin"),
  showLeadershipDashboard,
);
router.post(
  "/admin/leadership",
  requireRole("super_admin"),
  actionCreateLeadershipRole,
);
router.post(
  "/admin/leadership/:id",
  requireRole("super_admin"),
  actionUpdateLeadershipRole,
);
router.post(
  "/admin/leadership/:id/delete",
  requireRole("super_admin"),
  actionDeleteLeadershipRole,
);

// ---------------------------------------------------------------------------
// Business Directory Moderation
// ---------------------------------------------------------------------------

router.get(
  "/admin/businesses",
  requireRole("admin", "super_admin"),
  showPendingBusinesses,
);
router.post(
  "/admin/businesses/:id/approve",
  requireRole("admin", "super_admin"),
  actionApproveBusiness,
);
router.post(
  "/admin/businesses/:id/reject",
  requireRole("admin", "super_admin"),
  actionRejectBusiness,
);
router.post(
  "/admin/businesses/:id/feature",
  requireRole("admin", "super_admin"),
  actionToggleFeatured,
);

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

router.get(
  "/admin/campaigns",
  requireRole("admin", "super_admin"),
  showAdminCampaigns,
);
router.post(
  "/admin/campaigns",
  requireRole("admin", "super_admin"),
  actionCreateCampaign,
);
router.post(
  "/admin/campaigns/toggle-business",
  requireRole("admin", "super_admin"),
  actionToggleCampaignBusiness,
);
router.post(
  "/admin/campaigns/:id/update",
  requireRole("admin", "super_admin"),
  actionUpdateCampaign,
);
router.post(
  "/admin/campaigns/:id/delete",
  requireRole("admin", "super_admin"),
  actionDeleteCampaign,
);

// ---------------------------------------------------------------------------
// Financial Management
// Restricted to Super Admin, Chairperson and Treasurer.
// ---------------------------------------------------------------------------

router.get(
  "/admin/finance",
  requireAuth,
  requireFinanceAccess,
  showFinanceDashboard,
);

// Verify a pending contribution.
router.post(
  "/admin/finance/contributions/:id/verify",
  requireAuth,
  requireFinanceAccess,
  actionVerifyContribution,
);

// View private payment proof.
router.get(
  "/admin/finance/contributions/:id/proof",
  requireAuth,
  requireFinanceAccess,
  showFinanceContributionProof,
);

// Reject a pending contribution with a reason.
router.post(
  "/admin/finance/contributions/:id/reject",
  requireAuth,
  requireFinanceAccess,
  actionRejectContribution,
);

// Expenses.
router.post(
  "/admin/finance/expenses",
  requireAuth,
  requireFinanceAccess,
  actionCreateExpense,
);

router.post(
  "/admin/finance/expenses/:id/status",
  requireAuth,
  requireFinanceAccess,
  actionUpdateExpenseStatus,
);

router.post(
  "/admin/finance/expenses/:id/update",
  requireAuth,
  requireFinanceAccess,
  actionUpdateExpense,
);

router.post(
  "/admin/finance/expenses/:id/delete",
  requireAuth,
  requireFinanceAccess,
  actionDeleteExpense,
);

// Financial exports.
router.get(
  "/admin/finance/export/contributions",
  requireAuth,
  requireFinanceAccess,
  actionExportContributions,
);

router.get(
  "/admin/finance/export/expenses",
  requireAuth,
  requireFinanceAccess,
  actionExportAllExpenses,
);

router.get(
  "/admin/finance/export/expenses/:id",
  requireAuth,
  requireFinanceAccess,
  actionExportSingleExpense,
);

// ---------------------------------------------------------------------------
// Projects & Regional Development
// ---------------------------------------------------------------------------

// Project proposal approval access is based on current leadership roles
// or the Super Admin system role.
const requireProjectApprovalAccess = (req, res, next) => {
  const isSuperAdmin = req.userRoles?.includes("super_admin");
  const isChairperson = req.leadershipRoles?.includes("Chairperson");
  const isProjectsManager = req.leadershipRoles?.includes("Projects Manager");

  if (isSuperAdmin || isChairperson || isProjectsManager) {
    return next();
  }

  req.flash("error", "You do not have permission to review project proposals.");
  return res.redirect("/dashboard");
};

const requireProjectAccess = (req, res, next) => {
  const isSuperAdmin = req.userRoles?.includes("super_admin");
  const isChairperson = req.leadershipRoles?.includes("Chairperson");
  const isProjectsManager = req.leadershipRoles?.includes("Projects Manager");

  if (isSuperAdmin || isChairperson || isProjectsManager) {
    return next();
  }

  req.flash("error", "You do not have permission to manage projects.");
  return res.redirect("/dashboard");
};

router.get(
  "/admin/projects",
  requireRole("admin", "super_admin"),
  requireProjectAccess,
  showAdminProjects,
);

router.post(
  "/admin/projects",
  requireRole("admin", "super_admin"),
  requireProjectAccess,
  upload.single("image"),
  csrfCheck,
  actionCreateProject,
);

router.get(
  "/admin/projects/:id",
  requireRole("admin", "super_admin"),
  requireProjectAccess,
  showAdminProjectDetail,
);

router.post(
  "/admin/projects/:id/status",
  requireRole("admin", "super_admin"),
  requireProjectAccess,
  actionUpdateProjectStatus,
);

router.post(
  "/admin/projects/milestones",
  requireRole("admin", "super_admin"),
  requireProjectAccess,
  actionCreateMilestone,
);

router.post(
  "/admin/projects/milestones/:id/status",
  requireRole("admin", "super_admin"),
  requireProjectAccess,
  actionUpdateMilestoneStatus,
);

router.post(
  "/admin/projects/:id/update",
  requireRole("admin", "super_admin"),
  requireProjectAccess,
  actionUpdateProject,
);

router.post(
  "/admin/projects/:id/delete",
  requireRole("admin", "super_admin"),
  requireProjectAccess,
  actionDeleteProject,
);

router.post(
  "/admin/projects/:id/funds",
  requireRole("admin", "super_admin"),
  requireProjectAccess,
  actionUpdateFundsRaised,
);

// File uploads.
router.post(
  "/admin/projects/:id/files",
  requireRole("admin", "super_admin"),
  requireProjectAccess,
  upload.single("file"),
  csrfCheck,
  actionUploadProjectFile,
);

// ---------------------------------------------------------------------------
// Project proposal approval workflow.
router.get(
  "/admin/project-proposals",
  requireAuth,
  requireProjectApprovalAccess,
  showProjectApprovalQueue,
);

router.get(
  "/admin/project-proposals/:id",
  requireAuth,
  requireProjectApprovalAccess,
  showProjectProposalReview,
);

router.post(
  "/admin/project-proposals/:id/decision",
  requireAuth,
  requireProjectApprovalAccess,
  csrfCheck,
  actionDecideProjectProposal,
);

// Regional Reports
// Restricted to Super Admin, Chairperson and Projects Manager.
// ---------------------------------------------------------------------------

router.get(
  "/admin/regional-reports",
  requireRegionalReportsAccess,
  showRegionalReportsAdmin,
);

router.get(
  "/admin/regional-reports/:id/attachment",
  requireRegionalReportsAccess,
  actionDownloadRegionalReportAttachmentAdmin,
);

router.post(
  "/admin/regional-reports/:id/review",
  requireRegionalReportsAccess,
  actionMarkRegionalReportReviewed,
);

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

router.get(
  "/admin/analytics",
  requireRole("super_admin"),
  showAnalyticsDashboard,
);

export default router;
