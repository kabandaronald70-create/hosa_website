import { Router } from "express";
import { showDashboard } from "../controllers/memberController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/dashboard", requireAuth, showDashboard);

export default router;
