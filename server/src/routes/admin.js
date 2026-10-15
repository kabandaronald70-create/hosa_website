import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { showAdminOverview } from "../controllers/adminController.js";

const router = Router();

// Anyone with admin or moderator role can reach this router.
router.use("/admin", requireRole("admin", "super_admin", "moderator"));

router.get("/admin", showAdminOverview);

export default router;
