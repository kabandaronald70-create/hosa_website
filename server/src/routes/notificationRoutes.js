import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  showNotifications,
  actionMarkRead,
  actionMarkAllRead,
  apiListMyNotifications,
} from "../controllers/notificationController.js";

const router = Router();

router.get("/notifications", requireAuth, showNotifications);
router.post("/notifications/:id/read", requireAuth, actionMarkRead);
router.post("/notifications/read-all", requireAuth, actionMarkAllRead);

// API for SPA badge (optional integration later)
router.get("/api/me/notifications", requireAuth, apiListMyNotifications);

export default router;
