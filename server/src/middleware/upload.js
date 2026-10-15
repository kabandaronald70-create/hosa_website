import multer from "multer";

// Memory storage: the file never touches disk. Fine for 2 MB avatars.
// If we later accept larger files, switch to disk storage with a temp dir.
const storage = multer.memoryStorage();

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const uploadAvatar = multer({
  storage,
  limits: {
    fileSize: MAX_AVATAR_BYTES,
    files: 1,
    fields: 10,
    parts: 11,
  },
  fileFilter(req, file, cb) {
    // Note: file.mimetype is client-supplied and untrusted.
    // We check it here as a cheap filter, then re-check with magic bytes
    // in the service layer (file-type) before uploading.
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      const err = new Error("Only JPEG, PNG, or WebP images are allowed.");
      err.status = 400;
      err.code = "INVALID_FILE_TYPE";
      return cb(err);
    }
    cb(null, true);
  },
}).single("avatar");
