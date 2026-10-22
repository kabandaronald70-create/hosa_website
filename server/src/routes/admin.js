import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import {
  showPendingBusinesses,
  actionApproveBusiness,
  actionRejectBusiness,
  actionToggleFeatured,
} from "../controllers/businessController.js";
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
} from "../controllers/adminController.js";

const router = Router();

router.use("/admin", requireRole("admin", "super_admin", "moderator"));

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

export default router;
