import { Router } from "express";
import healthRoutes from "./health.js";
import styleguideRoutes from "./styleguide.js";
import authRoutes from "./auth.js";
import profileRoutes from "./profile.js";
import submissionRoutes from "./submissionRoutes.js";
import interactiveRoutes from "./interactiveRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import memberRoutes from "./member.js";
import apiPublicRoutes from "./apiPublic.js";
import adminRoutes from "./admin.js";
import publicEjsRoutes from "./publicEjsRoutes.js";
import publicRoutes from "./publicRoutes.js";
import superAdminRoutes from "./superAdminRoutes.js";
import { requireAuth } from "../middleware/auth.js";
import { requireApproved } from "../middleware/requireApproved.js";

const router = Router();

router.use(apiPublicRoutes);
router.use(healthRoutes);
router.use(styleguideRoutes);
router.use(authRoutes);

// Every member dashboard page requires login + membership approval.
// Unapproved members are redirected to the pending-approval page.
router.use("/dashboard", requireAuth, requireApproved);

router.use(profileRoutes);
router.use(submissionRoutes);
router.use(interactiveRoutes);
router.use(notificationRoutes);
router.use(memberRoutes);
router.use(publicEjsRoutes);
router.use(publicRoutes);
router.use(adminRoutes);
router.use(superAdminRoutes);

export default router;
