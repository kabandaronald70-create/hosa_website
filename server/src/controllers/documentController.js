import path from "node:path";
import fs from "node:fs/promises";
import multer from "multer";
import { fileURLToPath } from "node:url";
import {
  listDocuments,
  createDocument,
  getDocumentById,
  deleteDocument,
} from "../models/documentModel.js";
import { auditLog } from "../services/auditService.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(
  __dirname,
  "..",
  "..",
  "public",
  "uploads",
  "documents",
);

// Configure multer for document uploads (10MB limit)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(UPLOAD_DIR, { recursive: true })
      .then(() => cb(null, UPLOAD_DIR))
      .catch(cb);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname.replace(/\s+/g, "_"));
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single("document");

// --- Show Document Library on Archive Page ---
export async function getArchiveDocuments(req, res, next) {
  try {
    const documents = await listDocuments();
    res.render("public/archive", {
      title: "Archive — HOSA",
      layout: "layouts/public",
      pastEvents: [], // We will fetch these in the route
      stories: [], // We will fetch these in the route
      documents: documents,
    });
  } catch (err) {
    next(err);
  }
}

// --- Super Admin Upload ---
export async function showUploadForm(req, res, next) {
  try {
    const documents = await listDocuments();
    res.render("super/documents", {
      title: "Manage Documents — Super Admin",
      layout: "layouts/app",
      documents,
    });
  } catch (err) {
    next(err);
  }
}

export async function handleUpload(req, res, next) {
  try {
    if (!req.file) {
      req.flash("error", "No file uploaded.");
      return res.redirect("/super/documents");
    }

    const { title, description } = req.body;
    if (!title) {
      req.flash("error", "Title is required.");
      return res.redirect("/super/documents");
    }

    const relativePath = "/uploads/documents/" + req.file.filename;

    const created = await createDocument({
      title: title.trim(),
      description: description ? description.trim() : null,
      fileName: req.file.originalname,
      filePath: relativePath,
      uploadedBy: req.user.id,
    });

    await auditLog({
      req,
      action: "document.upload",
      targetType: "document",
      targetId: created.id,
      metadata: { title: created.title },
    });

    req.flash("success", `Document "${created.title}" uploaded successfully.`);
    res.redirect("/super/documents");
  } catch (err) {
    logger.error({ err }, "Document upload failed");
    next(err);
  }
}

export async function handleDelete(req, res, next) {
  try {
    const doc = await getDocumentById(req.params.id);
    if (doc) {
      // Delete file from disk
      const fullPath = path.join(
        __dirname,
        "..",
        "..",
        "public",
        doc.file_path,
      );
      await fs.unlink(fullPath).catch(() => {}); // Ignore if file missing

      await deleteDocument(req.params.id);
      await auditLog({
        req,
        action: "document.delete",
        targetType: "document",
        targetId: req.params.id,
      });
      req.flash("success", "Document deleted.");
    }
    res.redirect("/super/documents");
  } catch (err) {
    next(err);
  }
}
