import { Router } from "express";
import healthRoutes from "./health.js";
import authRoutes from "./auth.js";
import profileRoutes from "./profile.js";
import submissionRoutes from "./submissionRoutes.js";
import interactiveRoutes from "./interactiveRoutes.js";
import memberRoutes from "./member.js";
import apiPublicRoutes from "./apiPublic.js";
import adminRoutes from "./admin.js";

const router = Router();

router.use(apiPublicRoutes);
router.use(healthRoutes);
router.use(authRoutes);
router.use(profileRoutes);
router.use(submissionRoutes);
router.use(interactiveRoutes);
router.use(memberRoutes);
router.use(adminRoutes);

export default router;
