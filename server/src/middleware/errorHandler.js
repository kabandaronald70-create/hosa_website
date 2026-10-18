import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export function errorHandler(err, req, res, next) {
  // Translate multer errors into user-facing messages.
  if (err && err.code === "LIMIT_FILE_SIZE") {
    err.status = 413;
    err.message = "File is too large. Avatars must be 2 MB or smaller.";
  } else if (err && err.code === "LIMIT_UNEXPECTED_FILE") {
    err.status = 400;
    err.message = "Unexpected file field.";
  }

  const status = err.status || err.statusCode || 500;
  const isServerError = status >= 500;

  if (isServerError) {
    logger.error({ err, url: req.originalUrl }, "Unhandled error");
  }

  // JSON response for API routes
  if (
    req.path.startsWith("/api/") ||
    req.accepts(["html", "json"]) === "json"
  ) {
    const payload = {
      error: isServerError
        ? "Internal Server Error"
        : err.message || "Request failed",
    };
    if (env.isDev && isServerError) {
      payload.stack = err.stack;
    }
    return res.status(status).json(payload);
  }

  // HTML response for browser routes
  // Render the styled 500 page and pass a helpful error message in dev mode
  return res.status(status).render("public/500", {
    title: "Something went wrong",
    layout: "layouts/public",
    errorMessage: env.isDev && isServerError ? err.message : null,
  });
}
