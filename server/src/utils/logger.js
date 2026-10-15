import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.log.level,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "*.password",
      "*.password_hash",
      "*.token",
      "*.secret",
    ],
    censor: "[REDACTED]",
  },
  transport: env.isDev
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
      }
    : undefined,
});
