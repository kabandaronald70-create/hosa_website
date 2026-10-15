import { Router } from "express";
import healthRoutes from "./health.js";
import authRoutes from "./auth.js";
import memberRoutes from "./member.js";

const router = Router();

router.use(healthRoutes);
router.use(authRoutes);
router.use(memberRoutes);

export default router;
