import { Router } from "express";
import {
  showRegisterForm,
  submitRegister,
  showLoginForm,
  submitLogin,
  logout,
  handleVerifyEmail,
  resendVerification,
} from "../controllers/authController.js";
import {
  showForgotPasswordForm,
  submitForgotPassword,
  showResetPasswordForm,
  submitResetPassword,
} from "../controllers/authController.js";
import { requireGuest, requireAuth } from "../middleware/auth.js";
import { loginLimiter, registerLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.get("/register", requireGuest, showRegisterForm);
router.post("/register", requireGuest, registerLimiter, submitRegister);

router.get("/login", requireGuest, showLoginForm);
router.post("/login", requireGuest, loginLimiter, submitLogin);

router.post("/logout", requireAuth, logout);

router.get("/verify-email", handleVerifyEmail);
router.get("/verify-required", requireAuth, (req, res) => {
  res.render("auth/verify-required", {
    title: "Verify Email — HOSA",
    layout: "layouts/public",
  });
});
router.get("/forgot-password", requireGuest, showForgotPasswordForm);
router.post("/forgot-password", requireGuest, submitForgotPassword);

router.get("/reset-password", requireGuest, showResetPasswordForm);
router.post("/reset-password", requireGuest, submitResetPassword);

router.post("/resend-verification", requireAuth, resendVerification);

export default router;
