import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireVerified } from "../middleware/requireVerified.js"; // ← Added
import { setRsvp, cancelRsvp } from "../controllers/rsvpController.js";
import {
  showNewRequestForm,
  submitNewRequest,
  showMyRequests,
  actionAccept,
  actionDecline,
  actionCancel,
} from "../controllers/mentorshipController.js";
import {
  addSaved,
  removeSaved,
  showMySaved,
} from "../controllers/savedItemsController.js";

const router = Router();

// RSVPs require verification
router.post("/events/:slug/rsvp", requireAuth, requireVerified, setRsvp);
router.post(
  "/events/:slug/rsvp/cancel",
  requireAuth,
  requireVerified,
  cancelRsvp,
);

// Mentorship Requests require verification
router.get(
  "/dashboard/mentorship/requests/new",
  requireAuth,
  requireVerified,
  showNewRequestForm,
);
router.post(
  "/dashboard/mentorship/requests/new",
  requireAuth,
  requireVerified,
  submitNewRequest,
);

// Viewing and managing existing requests only requires login
router.get("/dashboard/mentorship/requests", requireAuth, showMyRequests);
router.post(
  "/dashboard/mentorship/requests/:id/accept",
  requireAuth,
  actionAccept,
);
router.post(
  "/dashboard/mentorship/requests/:id/decline",
  requireAuth,
  actionDecline,
);
router.post(
  "/dashboard/mentorship/requests/:id/cancel",
  requireAuth,
  actionCancel,
);

// Saved items (only view requires login, add/remove requires verification)
router.get("/dashboard/saved", requireAuth, showMySaved);
router.post("/dashboard/saved", requireAuth, requireVerified, addSaved);
router.post(
  "/dashboard/saved/:id/delete",
  requireAuth,
  requireVerified,
  removeSaved,
);

export default router;
