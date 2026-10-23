import multer from "multer";

// Memory storage: the file never touches disk.
// We upload directly to Supabase Storage from memory.
const storage = multer.memoryStorage();

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Shared file filter for both avatars and logos
const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIMES.has(file.mimetype)) {
    const err = new Error("Only JPEG, PNG, or WebP images are allowed.");
    err.status = 400;
    err.code = "INVALID_FILE_TYPE";
    return cb(err);
  }
  cb(null, true);
};

// --- Avatar Setup ---
export const uploadAvatar = multer({
  storage,
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1, fields: 10, parts: 11 },
  fileFilter,
}).single("avatar");

// --- Business Logo Setup (Now uses memory storage) ---
export const uploadLogo = multer({
  storage,
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
  fileFilter,
}).single("logo");

// --- Document Upload Setup (PDFs, Word Docs) ---
const ALLOWED_DOC_MIMES = new Set([
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);

export const uploadDocument = multer({
  storage, // Using memory storage from earlier
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB limit
  fileFilter(req, file, cb) {
    if (!ALLOWED_DOC_MIMES.has(file.mimetype)) {
      const err = new Error("Only PDF and Word documents are allowed.");
      err.status = 400;
      err.code = "INVALID_FILE_TYPE";
      return cb(err);
    }
    cb(null, true);
  },
}).single("document");
