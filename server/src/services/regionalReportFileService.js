import crypto from "node:crypto";
import { fileTypeFromBuffer } from "file-type";

import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPE = "application/pdf";

/**
 * Upload a private regional report attachment.
 *
 * Returns:
 * {
 *   storagePath: "user-id/random-id.pdf",
 *   originalName: "report.pdf"
 * }
 */
export async function uploadRegionalReportFile(userId, buffer, originalName) {
  if (!buffer || buffer.length === 0) {
    throw httpError(400, "EMPTY_FILE", "No file was uploaded.");
  }

  if (buffer.length > MAX_BYTES) {
    throw httpError(
      413,
      "FILE_TOO_LARGE",
      "Regional report attachments must be 10 MB or smaller.",
    );
  }

  // Inspect the actual file contents rather than trusting the browser.
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected || detected.mime !== ALLOWED_MIME_TYPE) {
    throw httpError(
      400,
      "INVALID_FILE_TYPE",
      "Only valid PDF documents are accepted.",
    );
  }

  // Never use the original filename as the storage object name.
  const objectKey = `${userId}/${crypto.randomUUID()}.pdf`;

  const { error } = await supabase.storage
    .from(env.supabase.regionalReportBucket)
    .upload(objectKey, buffer, {
      contentType: ALLOWED_MIME_TYPE,
      cacheControl: "0",
      upsert: false,
    });

  if (error) {
    logger.error(
      { err: error, userId },
      "Regional report attachment upload failed",
    );

    throw httpError(
      502,
      "STORAGE_UPLOAD_FAILED",
      "Could not store the regional report attachment.",
    );
  }

  // Keep the original filename only as display metadata.
  const safeOriginalName = String(originalName || "report.pdf")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 255);

  return {
    storagePath: objectKey,
    originalName: safeOriginalName || "report.pdf",
  };
}

/**
 * Generate a short-lived URL for an authorized attachment request.
 */
export async function createRegionalReportSignedUrl(storagePath) {
  if (!storagePath) {
    throw httpError(404, "ATTACHMENT_NOT_FOUND", "No attachment is available.");
  }

  const { data, error } = await supabase.storage
    .from(env.supabase.regionalReportBucket)
    .createSignedUrl(storagePath, env.supabase.signedUrlTtlSeconds);

  if (error || !data?.signedUrl) {
    logger.error(
      { err: error, storagePath },
      "Could not generate regional report download URL",
    );

    throw httpError(
      502,
      "SIGNED_URL_FAILED",
      "Could not generate the attachment download link.",
    );
  }

  return data.signedUrl;
}

/**
 * Remove a private regional report attachment.
 */
export async function removeRegionalReportFile(storagePath) {
  if (!storagePath) return;

  const { error } = await supabase.storage
    .from(env.supabase.regionalReportBucket)
    .remove([storagePath]);

  if (error) {
    logger.error(
      { err: error, storagePath },
      "Regional report attachment deletion failed",
    );

    throw httpError(
      502,
      "STORAGE_DELETE_FAILED",
      "Could not delete the regional report attachment.",
    );
  }
}

/**
 * Remove an uploaded object when a later operation fails.
 * Cleanup must not hide the original database error.
 */
export async function cleanupRegionalReportFile(storagePath) {
  if (!storagePath) return;

  try {
    await removeRegionalReportFile(storagePath);
  } catch (err) {
    logger.warn(
      { err, storagePath },
      "Could not clean up regional report attachment",
    );
  }
}

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}
