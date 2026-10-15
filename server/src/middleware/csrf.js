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

  if (!req.session.csrfToken) {
    req.session.csrfToken = generateToken(req.sessionID);
  }
  res.locals.csrfToken = req.session.csrfToken;
  res.locals.csrfField = env.csrf.fieldName;

  if (SAFE_METHODS.has(req.method)) return next();

  // For state-changing requests, verify.
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
