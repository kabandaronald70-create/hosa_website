import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const isServerError = status >= 500;

  if (isServerError) {
    logger.error({ err, url: req.originalUrl }, "Unhandled error");
  }

  const payload = {
    error: isServerError
      ? "Internal Server Error"
      : err.message || "Request failed",
  };
  if (env.isDev && isServerError) {
    payload.stack = err.stack;
  }

  if (
    req.path.startsWith("/api/") ||
    req.accepts(["html", "json"]) === "json"
  ) {
    return res.status(status).json(payload);
  }
  res.status(status).type("text/plain").send(payload.error);
}
