import { Router } from "express";
import { showDashboard } from "../controllers/memberController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireVerified } from "../middleware/requireVerified.js";

const router = Router();

// Update the dashboard route to require BOTH auth and verification
router.get("/dashboard", requireAuth, requireVerified, showDashboard);

export default router;
