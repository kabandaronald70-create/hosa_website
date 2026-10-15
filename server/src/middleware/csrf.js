import crypto from "node:crypto";
import { env } from "../config/env.js";

// Signed-token CSRF: no server-side storage needed.
// Token = HMAC(secret, sessionId + ':' + randomNonce)
// The token is written into the session (csrfToken) and into a hidden form field.
// On POST we compare the submitted field to the session value in constant time.

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

  // Always ensure a token exists so views can render it.
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateToken(req.sessionID);
  }
  res.locals.csrfToken = req.session.csrfToken;
  res.locals.csrfField = env.csrf.fieldName;

  if (SAFE_METHODS.has(req.method)) return next();

  // Multipart bodies aren't parsed yet at this point in the chain.
  // Let csrfCheck() (mounted after multer) verify those instead.
  const contentType = req.get("content-type") || "";
  if (contentType.startsWith("multipart/form-data")) return next();

  // For everything else (urlencoded/json), verify now.
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

/**
 * Verification-only CSRF middleware.
 * Use this on routes where the body is parsed by something else (e.g. multer
 * for multipart/form-data) AFTER the global csrf() middleware has already run.
 * Assumes req.session.csrfToken exists (csrf() set it earlier in the chain).
 */
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
