import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { csrfCheck } from "../middleware/csrf.js";
import {
  showRoleManagement,
  actionChangeRole,
  showSystemHealth,
} from "../controllers/superAdminController.js";
import {
  showUploadForm,
  handleUpload,
  handleDelete,
  handleUpdateAccessLevel,
  upload,
} from "../controllers/documentController.js";

const router = Router();

router.use("/super", requireRole("super_admin"));

router.get("/super/roles", showRoleManagement);
router.post("/super/roles/:id", actionChangeRole);
router.get("/super/health", showSystemHealth);

// --- Document Management ---

router.get("/super/documents", showUploadForm);

// Multipart upload: Multer first, followed by explicit CSRF validation.
router.post("/super/documents", upload, csrfCheck, handleUpload);

// Change a document's access level.
router.post(
  "/super/documents/:id/access-level",
  csrfCheck,
  handleUpdateAccessLevel,
);

// Delete document metadata.
router.post("/super/documents/:id/delete", csrfCheck, handleDelete);

export default router;
