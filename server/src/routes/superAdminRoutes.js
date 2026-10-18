import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import {
  showRoleManagement,
  actionChangeRole,
  showSystemHealth,
} from "../controllers/superAdminController.js";
import {
  showUploadForm,
  handleUpload,
  handleDelete,
  upload, // The multer middleware
} from "../controllers/documentController.js";

const router = Router();

router.use("/super", requireRole("super_admin"));

router.get("/super/roles", showRoleManagement);
router.post("/super/roles/:id", actionChangeRole);
router.get("/super/health", showSystemHealth);

// Document Management
router.get("/super/documents", showUploadForm);
router.post("/super/documents", upload, handleUpload);
router.post("/super/documents/:id/delete", handleDelete);

export default router;
