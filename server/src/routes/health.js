import { Router } from "express";
import { ping } from "../config/db.js";
import { logger } from "../utils/logger.js";

const router = Router();

router.get("/health", async (req, res) => {
  const startedAt = Date.now();

  try {
    const dbOk = await ping();

    if (!dbOk) {
      return res.status(503).json({
        status: "degraded",
        db: "down",
        db_check_ms: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      status: "ok",
      uptime_s: Math.round(process.uptime()),
      db: "ok",
      db_check_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(
      { err },
      "Health check failed: database connection unavailable",
    );

    return res.status(503).json({
      status: "degraded",
      db: "down",
      db_check_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
