import crypto from "node:crypto";
import { env } from "../config/env.js";

// Signed-token CSRF: no server-side storage needed.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function sign(sessionId, nonce) {
  return crypto
    .createHmac("sha256", env.csrf.secret)
    .update(`${sessionId}.${nonce}`)
    .digest("hex");
}

function generateToken(sessionId) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const mac = sign(sessionId, nonce);
  return `${nonce}.${mac}`;
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function csrf(req, res, next) {
  if (!req.session) {
    return next(new Error("csrf middleware requires a session"));
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = generateToken(req.sessionID);
  }
  res.locals.csrfToken = req.session.csrfToken;
  res.locals.csrfField = env.csrf.fieldName;

  if (SAFE_METHODS.has(req.method)) return next();

  // JSON API bypass: these requests are protected by SameSite cookies and
  // require JSON Content-Type, which cannot be sent cross-site without CORS.
  if (req.path.startsWith("/api/") || req.originalUrl.startsWith("/api/")) {
    return next();
  }

  const contentType = req.get("content-type") || "";
  if (contentType.startsWith("multipart/form-data")) return next();

  const submitted =
    req.body?.[env.csrf.fieldName] || req.get(env.csrf.headerName) || "";

  if (!submitted || !safeEqual(submitted, req.session.csrfToken)) {
    const err = new Error("Invalid or missing CSRF token.");
    err.status = 403;
    err.code = "CSRF_FAILED";
    return next(err);
  }
  next();
}

export function csrfCheck(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  if (!req.session?.csrfToken) {
    const err = new Error("CSRF session missing.");
    err.status = 403;
    err.code = "CSRF_FAILED";
    return next(err);
  }

  const submitted =
    req.body?.[env.csrf.fieldName] || req.get(env.csrf.headerName) || "";

  if (!submitted || !safeEqual(submitted, req.session.csrfToken)) {
    const err = new Error("Invalid or missing CSRF token.");
    err.status = 403;
    err.code = "CSRF_FAILED";
    return next(err);
  }
  next();
}
