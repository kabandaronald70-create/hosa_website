import crypto from "node:crypto";
import { fileTypeFromBuffer } from "file-type";

import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

/**
 * Upload a member's private contribution payment proof.
 *
 * Returns:
 * {
 *   storagePath: "user-id/random-id.jpg",
 *   originalName: "payment-slip.jpg"
 * }
 */
export async function uploadContributionProofFile(
  userId,
  buffer,
  originalName,
) {
  if (!buffer || buffer.length === 0) {
    throw httpError(400, "EMPTY_FILE", "No payment proof image was uploaded.");
  }

  if (buffer.length > MAX_BYTES) {
    throw httpError(
      413,
      "FILE_TOO_LARGE",
      "Payment proof images must be 5 MB or smaller.",
    );
  }

  // Validate actual image contents, not the browser MIME type or extension.
  const detected = await fileTypeFromBuffer(buffer);
  const extension = detected
    ? ALLOWED_TYPES.get(detected.mime)
    : null;

  if (!detected || !extension) {
    throw httpError(
      400,
      "INVALID_FILE_TYPE",
      "Only valid JPEG, PNG, or WebP images are accepted.",
    );
  }

  // Generate a random object name. Never trust the supplied filename.
  const objectKey = `${userId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(env.supabase.contributionProofBucket)
    .upload(objectKey, buffer, {
      contentType: detected.mime,
      cacheControl: "0",
      upsert: false,
    });

  if (error) {
    logger.error(
      { err: error, userId },
      "Contribution payment proof upload failed",
    );

    throw httpError(
      502,
      "STORAGE_UPLOAD_FAILED",
      "Could not store the contribution payment proof.",
    );
  }

  // Keep the original filename only as safe display metadata.
  const safeOriginalName = String(originalName || `payment-proof.${extension}`)
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 255);

  return {
    storagePath: objectKey,
    originalName: safeOriginalName || `payment-proof.${extension}`,
  };
}

/**
 * Generate a short-lived URL after the caller has authorized access.
 */
export async function createContributionProofSignedUrl(storagePath) {
  if (!storagePath) {
    throw httpError(
      404,
      "PAYMENT_PROOF_NOT_FOUND",
      "No payment proof is available.",
    );
  }

  const { data, error } = await supabase.storage
    .from(env.supabase.contributionProofBucket)
    .createSignedUrl(storagePath, env.supabase.signedUrlTtlSeconds);

  if (error || !data?.signedUrl) {
    logger.error(
      { err: error, storagePath },
      "Could not generate contribution payment proof URL",
    );

    throw httpError(
      502,
      "SIGNED_URL_FAILED",
      "Could not generate the payment proof viewing link.",
    );
  }

  return data.signedUrl;
}

/**
 * Remove a private contribution payment proof.
 */
export async function removeContributionProofFile(storagePath) {
  if (!storagePath) return;

  const { error } = await supabase.storage
    .from(env.supabase.contributionProofBucket)
    .remove([storagePath]);

  if (error) {
    logger.error(
      { err: error, storagePath },
      "Contribution payment proof deletion failed",
    );

    throw httpError(
      502,
      "STORAGE_DELETE_FAILED",
      "Could not delete the contribution payment proof.",
    );
  }
}

/**
 * Attempt cleanup without hiding the original database error.
 */
export async function cleanupContributionProofFile(storagePath) {
  if (!storagePath) return;

  try {
    await removeContributionProofFile(storagePath);
  } catch (err) {
    logger.warn(
      { err, storagePath },
      "Could not clean up contribution payment proof",
    );
  }
}

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}