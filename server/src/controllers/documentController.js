import multer from "multer";
import {
  listDocuments,
  createDocument,
  getDocumentById,
  deleteDocument,
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      const err = new Error("Only PDF and Word documents are allowed.");
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
}).single("document");

// --- Show Document Library on Archive Page ---
export async function getArchiveDocuments(req, res, next) {
  try {
    const documents = await listDocuments();
    res.render("public/archive", {
      title: "Archive — HOSA",
      layout: "layouts/public",
      pastEvents: [],
      stories: [],
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
      (character) =>
        `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
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

    // 1. Upload to Supabase Storage
    const storagePath = await uploadDocumentToStorage(
      req.user.id,
      req.file.buffer, // Memory storage gives us the buffer
      req.file.mimetype,
      req.file.originalname,
    );

    // 2. Save metadata to the database
    const created = await createDocument({
      title: title.trim(),
      description: description ? description.trim() : null,
      fileName: req.file.originalname,
      filePath: storagePath, // Store the Supabase path
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
      // Note: We are NOT deleting the physical file from Supabase here.
      // If you want to delete from Supabase too, you would call:
      // await supabase.storage.from('hosa-documents').remove([doc.file_path]);

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
