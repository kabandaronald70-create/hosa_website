import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
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

// RSVPs
router.post("/events/:slug/rsvp", requireAuth, setRsvp);
router.post("/events/:slug/rsvp/cancel", requireAuth, cancelRsvp);

// Mentorship
router.get(
  "/dashboard/mentorship/requests/new",
  requireAuth,
  showNewRequestForm,
);
router.post(
  "/dashboard/mentorship/requests/new",
  requireAuth,
  submitNewRequest,
);
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

// Saved items
router.get("/dashboard/saved", requireAuth, showMySaved);
router.post("/dashboard/saved", requireAuth, addSaved);
router.post("/dashboard/saved/:id/delete", requireAuth, removeSaved);

export default router;
