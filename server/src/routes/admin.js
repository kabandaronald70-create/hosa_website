import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { csrfCheck } from "../middleware/csrf.js";
import {
  requireFinanceAccess,
  requireFinanceDashboardAccess,
  requireExpenseWorkflowAccess,
} from "../middleware/requireFinanceAccess.js";
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
// Finance, regional reports, Projects Management and project proposal
// routes have dedicated authentication and authorization middleware.
router.use("/admin", (req, res, next) => {
  const isRegionalReportsRoute =
    req.path === "/regional-reports" ||
    req.path.startsWith("/regional-reports/");

  const isFinanceRoute =
    req.path === "/finance" || req.path.startsWith("/finance/");

  const isProjectsRoute =
    req.path === "/projects" || req.path.startsWith("/projects/");

  const isProjectProposalsRoute =
    req.path === "/project-proposals" ||
    req.path.startsWith("/project-proposals/");

  if (
    isRegionalReportsRoute ||
    isFinanceRoute ||
    isProjectsRoute ||
    isProjectProposalsRoute
  ) {
    return next();
  }

  return requireRole("admin", "super_admin", "moderator")(req, res, next);
});

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
// ---------------------------------------------------------------------------

// Full Treasurer/Super Admin dashboard, with a restricted Chairperson view.
router.get(
  "/admin/finance",
  requireAuth,
  requireFinanceDashboardAccess,
  showFinanceDashboard,
);

// Contribution operations remain restricted to Treasurer and Super Admin.
router.post(
  "/admin/finance/contributions/:id/verify",
  requireAuth,
  requireFinanceAccess,
  actionVerifyContribution,
);

router.get(
  "/admin/finance/contributions/:id/proof",
  requireAuth,
  requireFinanceAccess,
  showFinanceContributionProof,
);

router.post(
  "/admin/finance/contributions/:id/reject",
  requireAuth,
  requireFinanceAccess,
  actionRejectContribution,
);

// Expense submission and approval use the separate office-role middleware.
// The controller and model must enforce the individual approval stages.
router.post(
  "/admin/finance/expenses",
  requireAuth,
  requireExpenseWorkflowAccess,
  actionCreateExpense,
);

router.post(
  "/admin/finance/expenses/:id/status",
  requireAuth,
  requireExpenseWorkflowAccess,
  actionUpdateExpenseStatus,
);

// Financial exports remain restricted to Treasurer and Super Admin.
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
// Project access permissions
// ---------------------------------------------------------------------------

function normalizeProjectRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getProjectSystemRoles(req) {
  return (req.userRoles || []).map(normalizeProjectRole);
}

function getProjectLeadershipRoles(req) {
  return (req.leadershipRoles || []).map(normalizeProjectRole);
}

// Project proposal approval remains a separate permission.
const requireProjectApprovalAccess = (req, res, next) => {
  const systemRoles = getProjectSystemRoles(req);
  const leadershipRoles = getProjectLeadershipRoles(req);

  const isSuperAdmin = systemRoles.includes("super_admin");
  const isChairperson = leadershipRoles.includes("chairperson");
  const isProjectsManager = leadershipRoles.includes("projects_manager");

  if (isSuperAdmin || isChairperson || isProjectsManager) {
    return next();
  }

  req.flash(
    "error",
    "Access denied. Project proposal review is restricted to the Projects Manager, Chairperson and Super Admin.",
  );

  return res.redirect("/dashboard");
};

// Viewing Projects Management allows Super Admin, Projects Manager
// and Chairperson.
const requireProjectAccess = (req, res, next) => {
  const systemRoles = getProjectSystemRoles(req);
  const leadershipRoles = getProjectLeadershipRoles(req);

  const isSuperAdmin = systemRoles.includes("super_admin");
  const isChairperson = leadershipRoles.includes("chairperson");
  const isProjectsManager = leadershipRoles.includes("projects_manager");

  if (isSuperAdmin || isChairperson || isProjectsManager) {
    return next();
  }

  req.flash(
    "error",
    "Access denied. Projects Management is restricted to the Projects Manager, Chairperson and Super Admin.",
  );

  return res.redirect("/dashboard");
};

// Only Super Admin and Projects Manager can modify projects.
// Chairperson is strictly read-only.
const requireProjectMutationAccess = (req, res, next) => {
  const systemRoles = getProjectSystemRoles(req);
  const leadershipRoles = getProjectLeadershipRoles(req);

  const isSuperAdmin = systemRoles.includes("super_admin");
  const isProjectsManager = leadershipRoles.includes("projects_manager");

  if (isSuperAdmin || isProjectsManager) {
    return next();
  }

  req.flash(
    "error",
    "Access denied. Only the Projects Manager and Super Admin can modify projects.",
  );

  return res.redirect("/admin/projects");
};

// ---------------------------------------------------------------------------
// Projects Management
// ---------------------------------------------------------------------------

// View project list: Super Admin, Projects Manager, Chairperson.
router.get(
  "/admin/projects",
  requireAuth,
  requireProjectAccess,
  showAdminProjects,
);

// Create project: Super Admin or Projects Manager.
router.post(
  "/admin/projects",
  requireAuth,
  requireProjectMutationAccess,
  upload.single("image"),
  csrfCheck,
  actionCreateProject,
);

// View individual project: Super Admin, Projects Manager, Chairperson.
router.get(
  "/admin/projects/:id",
  requireAuth,
  requireProjectAccess,
  showAdminProjectDetail,
);

// All project mutations: Super Admin or Projects Manager.
router.post(
  "/admin/projects/:id/status",
  requireAuth,
  requireProjectMutationAccess,
  actionUpdateProjectStatus,
);

router.post(
  "/admin/projects/milestones",
  requireAuth,
  requireProjectMutationAccess,
  actionCreateMilestone,
);

router.post(
  "/admin/projects/milestones/:id/status",
  requireAuth,
  requireProjectMutationAccess,
  actionUpdateMilestoneStatus,
);

router.post(
  "/admin/projects/:id/update",
  requireAuth,
  requireProjectMutationAccess,
  actionUpdateProject,
);

router.post(
  "/admin/projects/:id/delete",
  requireAuth,
  requireProjectMutationAccess,
  actionDeleteProject,
);

router.post(
  "/admin/projects/:id/funds",
  requireAuth,
  requireProjectMutationAccess,
  actionUpdateFundsRaised,
);

// File uploads: Super Admin or Projects Manager.
router.post(
  "/admin/projects/:id/files",
  requireAuth,
  requireProjectMutationAccess,
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
