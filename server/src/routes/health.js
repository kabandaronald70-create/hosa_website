import { Router } from "express";
import { ping } from "../config/db.js";

const router = Router();

router.get("/health", async (req, res) => {
  const startedAt = Date.now();
  let dbOk = false;
  let dbError;
  try {
    dbOk = await ping();
  } catch (err) {
    dbError = err.message;
  }

  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    uptime_s: Math.round(process.uptime()),
    db: dbOk ? "ok" : "down",
    db_check_ms: Date.now() - startedAt,
    ...(dbError ? { db_error: dbError } : {}),
    timestamp: new Date().toISOString(),
  });
});

export default router;
