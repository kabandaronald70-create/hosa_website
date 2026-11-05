import { Router } from "express";
import multer from "multer";
import { requireRole } from "../middleware/auth.js";
import { csrfCheck } from "../middleware/csrf.js";
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
  actionCreateExpense,
  actionUpdateExpenseStatus,
  actionUpdateExpense,
  actionDeleteExpense,
  actionExportContributions,
  actionExportAllExpenses,
  actionExportSingleExpense,
} from "../controllers/financeController.js";
import { requireRegionalReportsAccess } from "../middleware/requireRegionalReportsAccess.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use("/admin", (req, res, next) => {
  const isRegionalReportsRoute =
    req.path === "/regional-reports" ||
    req.path.startsWith("/regional-reports/");

  // Regional reports have their own dedicated authorization.
  if (isRegionalReportsRoute) {
    return next();
  }

  return requireRole("admin", "super_admin", "moderator")(req, res, next);
});

router.get("/admin", showAdminOverview);

// Members
router.get("/admin/members", showMembersList);
router.get("/admin/members/:id", showMemberDetail);
router.post("/admin/members/:id/verify", actionVerifyMember);
router.post("/admin/members/:id/unverify", actionUnverifyMember);
router.post("/admin/members/:id/suspend", actionSuspendMember);
router.post("/admin/members/:id/reactivate", actionReactivateMember);
router.post("/admin/members/:id/approve-membership", actionApproveMembership);

// Moderation
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

// Events
router.get("/admin/events", showEventsList);
router.get("/admin/events/new", showNewEventForm); // BEFORE :id
router.post("/admin/events/new", actionCreateEvent);
router.get("/admin/events/:id", showEventDetail);
router.get("/admin/events/:id/edit", showEditEventForm);
router.post("/admin/events/:id/update", actionUpdateEvent);
router.post("/admin/events/:id/status", actionSetEventStatus);

// Audit log
router.get("/admin/audit", showAuditLog);
router.get("/admin/audit/export.csv", exportAuditCsv);
router.get("/admin/audit/:id", showAuditDetail);

// Announcements
router.get("/admin/announcements", showAdminAnnouncements);
router.post("/admin/announcements", submitAnnouncement);
router.post("/admin/announcements/:id/delete", removeAnnouncement);

// Reports
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

// Leadership & Governance
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

// Business Directory Moderation
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

// Campaigns
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

const requireFinanceAccess = (req, res, next) => {
  const isSuperAdmin = req.userRoles.includes("super_admin");
  const isChairperson = req.leadershipRoles?.includes("Chairperson");
  const isTreasurer = req.leadershipRoles?.includes("Treasurer");

  if (isSuperAdmin || isChairperson || isTreasurer) {
    return next();
  }

  req.flash(
    "error",
    "You do not have permission to access the financial dashboard.",
  );
  res.redirect("/dashboard");
};

router.get(
  "/admin/finance",
  requireRole("admin", "super_admin"),
  requireFinanceAccess,
  showFinanceDashboard,
);

router.post(
  "/admin/finance/contributions/:id/verify",
  requireRole("admin", "super_admin"),
  requireFinanceAccess,
  actionVerifyContribution,
);

router.post(
  "/admin/finance/expenses",
  requireRole("admin", "super_admin"),
  requireFinanceAccess,
  actionCreateExpense,
);

router.post(
  "/admin/finance/expenses/:id/status",
  requireRole("admin", "super_admin"),
  requireFinanceAccess,
  actionUpdateExpenseStatus,
);

router.post(
  "/admin/finance/expenses/:id/update",
  requireRole("admin", "super_admin"),
  requireFinanceAccess,
  actionUpdateExpense,
);

router.post(
  "/admin/finance/expenses/:id/delete",
  requireRole("admin", "super_admin"),
  requireFinanceAccess,
  actionDeleteExpense,
);

// Document export
router.get(
  "/admin/finance/export/contributions",
  requireRole("admin", "super_admin"),
  requireFinanceAccess,
  actionExportContributions,
);
router.get(
  "/admin/finance/export/expenses",
  requireRole("admin", "super_admin"),
  requireFinanceAccess,
  actionExportAllExpenses,
);
router.get(
  "/admin/finance/export/expenses/:id",
  requireRole("admin", "super_admin"),
  requireFinanceAccess,
  actionExportSingleExpense,
);

// ---------------------------------------------------------------------------
// Projects & Regional Development
// ---------------------------------------------------------------------------

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

// File uploads
router.post(
  "/admin/projects/:id/files",
  requireRole("admin", "super_admin"),
  requireProjectAccess,
  upload.single("file"),
  csrfCheck,
  actionUploadProjectFile,
);

// Regional Reports (Restricted to Super Admin, Chairperson, Projects Manager)
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
// Analytics
router.get(
  "/admin/analytics",
  requireRole("super_admin"),
  showAnalyticsDashboard,
);
export default router;
