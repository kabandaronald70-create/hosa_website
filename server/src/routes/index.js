import { Router } from "express";
import healthRoutes from "./health.js";
import authRoutes from "./auth.js";
import profileRoutes from "./profile.js";
import memberRoutes from "./member.js";
import apiPublicRoutes from "./apiPublic.js";
import adminRoutes from "./admin.js";

const router = Router();

router.use(apiPublicRoutes); // /api/*
router.use(healthRoutes); // /health
router.use(authRoutes); // /login, /register, /logout
router.use(profileRoutes); // /dashboard/profile, /dashboard/avatar, ...
router.use(memberRoutes); // /dashboard
router.use(adminRoutes); // /admin/*

export default router;
