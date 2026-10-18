import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { csrfCheck } from "../middleware/csrf.js";
import { uploadAvatar as uploadMiddleware } from "../middleware/upload.js";
import {
  showEditProfile,
  submitEditProfile,
  showChangePassword,
  submitChangePassword,
  uploadAvatar,
  removeAvatar,
  serveAvatar,
  exportMyData,
  deleteMyAccount,
} from "../controllers/profileController.js";

const router = Router();

// Profile edit
router.get("/dashboard/profile", requireAuth, showEditProfile);
router.post("/dashboard/profile", requireAuth, submitEditProfile);

// Avatar
// Multer parses multipart/form-data, then csrfCheck verifies the token
// (the global csrf() middleware skips verification for multipart bodies).
router.post(
  "/dashboard/avatar",
  requireAuth,
  uploadMiddleware,
  csrfCheck,
  uploadAvatar,
);
router.post("/dashboard/avatar/delete", requireAuth, removeAvatar);

// Serving (order matters: 'me' must precede ':userId')
router.get("/dashboard/avatar/me", requireAuth, serveAvatar);
router.get("/dashboard/avatar/:userId", requireAuth, serveAvatar);

// Password
router.get("/dashboard/password", requireAuth, showChangePassword);
router.post("/dashboard/password", requireAuth, submitChangePassword);
router.get("/dashboard/export-data", requireAuth, exportMyData);
router.post("/dashboard/delete-account", requireAuth, deleteMyAccount);

export default router;
