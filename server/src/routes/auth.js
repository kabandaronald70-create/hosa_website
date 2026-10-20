import { Router } from "express";
import {
  showRegisterForm,
  submitRegister,
  showLoginForm,
  submitLogin,
  logout,
} from "../controllers/authController.js";
import { requireGuest, requireAuth } from "../middleware/auth.js";
import { loginLimiter, registerLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.get("/register", requireGuest, showRegisterForm);
router.post("/register", requireGuest, registerLimiter, submitRegister);

router.get("/login", requireGuest, showLoginForm);
router.post("/login", requireGuest, loginLimiter, submitLogin);

router.post("/logout", requireAuth, logout);

export default router;
