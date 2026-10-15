import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

function jsonHandler(req, res) {
  res.status(429).json({
    error: "Too many requests. Please try again later.",
  });
}

const common = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: jsonHandler,
  // Skip rate limiting in dev so we don't lock ourselves out while testing.
  skip: () => env.isDev,
};

export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 10, // 10 attempts / IP / window
});

export const registerLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10, // 10 registrations / IP / hour
});

export const passwordResetLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 5,
});
