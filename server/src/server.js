import http from "node:http";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { createApp } from "./app.js";
import { shutdownPool, ping } from "./config/db.js";

async function start() {
  try {
    const ok = await ping();
    if (!ok) throw new Error("DB ping returned false");
    logger.info("Postgres connection OK");
  } catch (err) {
    logger.error(
      { err },
      "Cannot reach Postgres at startup — check .env and that the service is running.",
    );
    process.exit(1);
  }

  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    logger.info(
      `HOSA backend listening on http://localhost:${env.PORT} (${env.NODE_ENV})`,
    );
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, "Shutting down…");
    server.close(async () => {
      try {
        await shutdownPool();
      } catch (err) {
        logger.error({ err }, "Error closing pool");
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
