import crypto from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";
import {
  setAvatarPath,
  clearAvatarPath,
  getProfileByUserId,
} from "../models/profileModel.js";
import { logger } from "../utils/logger.js";

const ALLOWED_MAGIC_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Validate + upload an avatar for a user, replacing any existing one.
 * Returns { path, signedUrl } on success.
 */
export async function uploadUserAvatar(userId, buffer) {
  if (!buffer || buffer.length === 0) {
    throw httpError(400, "EMPTY_FILE", "No file was uploaded.");
  }
  if (buffer.length > MAX_BYTES) {
    throw httpError(413, "FILE_TOO_LARGE", "Avatar must be 2 MB or smaller.");
  }

  // Magic-byte sniffing — do NOT trust the browser's Content-Type.
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_MAGIC_TYPES.has(detected.mime)) {
    throw httpError(
      400,
      "INVALID_FILE_TYPE",
      "File is not a valid JPEG, PNG, or WebP image.",
    );
  }
  const ext = ALLOWED_MAGIC_TYPES.get(detected.mime);

  const previous = await getProfileByUserId(userId);
  const previousPath = previous?.avatar_path || null;

  // Random object name — never trust the original filename.
  const objectKey = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(env.supabase.avatarBucket)
    .upload(objectKey, buffer, {
      contentType: detected.mime,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    logger.error({ err: uploadError }, "Supabase upload failed");
    throw httpError(502, "STORAGE_UPLOAD_FAILED", "Could not store the image.");
  }

  // Persist the new path. If this fails, remove the new object to avoid orphans.
  try {
    await setAvatarPath(userId, objectKey);
  } catch (dbErr) {
    logger.error(
      { err: dbErr },
      "DB update failed after avatar upload; cleaning up",
    );
    await removeObjectQuietly(objectKey);
    throw dbErr;
  }

  // Remove the previous object (best-effort — a leftover file is not fatal).
  if (previousPath && previousPath !== objectKey) {
    await removeObjectQuietly(previousPath);
  }

  const signedUrl = await signAvatarPath(objectKey);
  return { path: objectKey, signedUrl };
}

/**
 * Delete the caller's avatar. Clears the DB column and removes the object.
 */
export async function deleteUserAvatar(userId) {
  const profile = await getProfileByUserId(userId);
  const path = profile?.avatar_path || null;
  if (!path) return { removed: false };

  await clearAvatarPath(userId);
  await removeObjectQuietly(path);
  return { removed: true };
}

/**
 * Return a short-lived signed URL for a stored avatar path.
 * Called on every dashboard/directory render, so keep it cheap.
 */
export async function signAvatarPath(objectKey) {
  if (!objectKey) return null;
  const { data, error } = await supabase.storage
    .from(env.supabase.avatarBucket)
    .createSignedUrl(objectKey, env.supabase.signedUrlTtlSeconds);
  if (error || !data?.signedUrl) {
    logger.warn({ err: error, objectKey }, "Could not sign avatar URL");
    return null;
  }
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

async function removeObjectQuietly(objectKey) {
  try {
    const { error } = await supabase.storage
      .from(env.supabase.avatarBucket)
      .remove([objectKey]);
    if (error) logger.warn({ err: error, objectKey }, "Supabase remove failed");
  } catch (err) {
    logger.warn({ err, objectKey }, "Supabase remove threw");
  }
}
