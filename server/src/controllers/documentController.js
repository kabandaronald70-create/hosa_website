import multer from "multer";
import {
  listDocuments,
  createDocument,
  getDocumentById,
  deleteDocument,
  canAccessDocument,
  DOCUMENT_ACCESS_LEVELS,
  updateDocumentAccessLevel,
} from "../models/documentModel.js";
import { uploadDocumentToStorage } from "../services/documentService.js";
import { auditLog } from "../services/auditService.js";
import { logger } from "../utils/logger.js";
import { supabase } from "../config/supabase.js";

// --- Multer Config (Memory Storage) ---

const storage = multer.memoryStorage();

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      const err = new Error("Only PDF and Word documents are allowed.");
      err.status = 400;
      return cb(err);
    }

    cb(null, true);
  },
}).single("document");

// --- Document Access Permissions ---

function getDocumentPermissions(req) {
  return {
    isSuperAdmin: req.userRoles?.includes("super_admin") ?? false,

    isApprovedMember: Boolean(req.user?.membership_approved_at),

    hasCurrentLeadership:
      Array.isArray(req.leadershipRoles) && req.leadershipRoles.length > 0,
  };
}

// --- Super Admin Document Management ---

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

// --- View and Download ---

export function viewDocumentFile(req, res, next) {
  return sendDocumentFile(req, res, next, "inline");
}

export function downloadDocumentFile(req, res, next) {
  return sendDocumentFile(req, res, next, "attachment");
}

async function sendDocumentFile(req, res, next, disposition) {
  try {
    const document = await getDocumentById(req.params.id);

    if (!document?.file_path) {
      return res.status(404).type("text/plain").send("Document not found.");
    }

    // Enforce document-level permissions before accessing private storage.
    if (!canAccessDocument(document, getDocumentPermissions(req))) {
      return res
        .status(403)
        .type("text/plain")
        .send("You are not authorized to access this document.");
    }

    // Only authorized users can reach the Supabase download operation.
    const { data: file, error } = await supabase.storage
      .from("hosa-documents")
      .download(document.file_path);

    if (error) {
      logger.error(
        { err: error, documentId: document.id },
        "Document download failed",
      );

      throw new Error(`Document storage download failed: ${error.message}`);
    }

    if (!file) {
      throw new Error(`Document storage returned no file for ${document.id}.`);
    }

    const fileName = document.file_name || "document";

    const encodedFileName = encodeURIComponent(fileName).replace(
      /[!'()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );

    res.set({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedFileName}`,
      "Content-Type": file.type || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });

    res.send(Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    next(err);
  }
}

// --- Upload Document ---

export async function handleUpload(req, res, next) {
  try {
    const { title, description } = req.body;

    const accessLevel =
      req.body.access_level || DOCUMENT_ACCESS_LEVELS.SUPER_ADMIN_ONLY;

    if (!req.file) {
      req.flash("error", "No file uploaded.");
      return res.redirect("/super/documents");
    }

    if (!title || !title.trim()) {
      req.flash("error", "Title is required.");
      return res.redirect("/super/documents");
    }

    // Validate permissions before uploading to avoid orphaned storage files.
    if (!Object.values(DOCUMENT_ACCESS_LEVELS).includes(accessLevel)) {
      req.flash("error", "Invalid document access level.");
      return res.redirect("/super/documents");
    }

    // 1. Upload file to private Supabase Storage.
    const storagePath = await uploadDocumentToStorage(
      req.user.id,
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
    );

    // 2. Save document metadata and its selected access level.
    const created = await createDocument({
      title: title.trim(),
      description: description ? description.trim() : null,
      fileName: req.file.originalname,
      filePath: storagePath,
      uploadedBy: req.user.id,
      accessLevel,
    });

    await auditLog({
      req,
      action: "document.upload",
      targetType: "document",
      targetId: created.id,
      metadata: {
        title: created.title,
        accessLevel: created.access_level,
      },
    });

    req.flash("success", `Document "${created.title}" uploaded successfully.`);

    res.redirect("/super/documents");
  } catch (err) {
    logger.error({ err }, "Document upload failed");
    next(err);
  }
}

// --- Update Document Access Level ---

export async function handleUpdateAccessLevel(req, res, next) {
  try {
    const { id } = req.params;
    const accessLevel = req.body.access_level;

    if (!Object.values(DOCUMENT_ACCESS_LEVELS).includes(accessLevel)) {
      req.flash("error", "Invalid document access level.");
      return res.redirect("/super/documents");
    }

    const existingDocument = await getDocumentById(id);

    if (!existingDocument) {
      req.flash("error", "Document not found.");
      return res.redirect("/super/documents");
    }

    const updatedDocument = await updateDocumentAccessLevel(id, accessLevel);

    if (!updatedDocument) {
      req.flash("error", "Document could not be updated.");
      return res.redirect("/super/documents");
    }

    await auditLog({
      req,
      action: "document.access_level.update",
      targetType: "document",
      targetId: updatedDocument.id,
      metadata: {
        title: updatedDocument.title,
        previousAccessLevel: existingDocument.access_level,
        newAccessLevel: updatedDocument.access_level,
      },
    });

    req.flash(
      "success",
      `Access level updated for "${updatedDocument.title}".`,
    );

    res.redirect("/super/documents");
  } catch (err) {
    logger.error({ err }, "Document access-level update failed");
    next(err);
  }
}

// --- Delete Document ---

export async function handleDelete(req, res, next) {
  try {
    const doc = await getDocumentById(req.params.id);

    if (doc) {
      // The physical Supabase file is intentionally not deleted here.
      // Storage cleanup can be implemented separately.

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
