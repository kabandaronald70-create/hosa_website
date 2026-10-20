import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireApproved } from "../middleware/requireApproved.js";
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

// RSVPs require login + membership approval (these are not under /dashboard).
router.post("/events/:slug/rsvp", requireAuth, requireApproved, setRsvp);
router.post(
  "/events/:slug/rsvp/cancel",
  requireAuth,
  requireApproved,
  cancelRsvp,
);

// Everything below lives under /dashboard, which is gated by login + membership
// approval in routes/index.js.
router.get("/dashboard/mentorship/requests/new", requireAuth, showNewRequestForm);
router.post("/dashboard/mentorship/requests/new", requireAuth, submitNewRequest);

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

router.get("/dashboard/saved", requireAuth, showMySaved);
router.post("/dashboard/saved", requireAuth, addSaved);
router.post("/dashboard/saved/:id/delete", requireAuth, removeSaved);

export default router;
