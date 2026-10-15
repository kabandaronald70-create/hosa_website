import { Router } from "express";
import healthRoutes from "./health.js";
import authRoutes from "./auth.js";
import profileRoutes from "./profile.js";
import memberRoutes from "./member.js";
import apiPublicRoutes from "./apiPublic.js";

const router = Router();

router.use(apiPublicRoutes); // /api/* first
router.use(healthRoutes);
router.use(authRoutes);
router.use(profileRoutes);
router.use(memberRoutes);

export default router;
