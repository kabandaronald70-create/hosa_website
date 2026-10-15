#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, withTransaction, shutdownPool } from "../src/config/db.js";
import { logger } from "../src/utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureSchemaMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getApplied() {
  const { rows } = await pool.query(
    "SELECT filename FROM schema_migrations ORDER BY filename",
  );
  return new Set(rows.map((r) => r.filename));
}

async function listMigrationFiles() {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  return entries
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

async function apply(file) {
  const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
  await withTransaction(async (client) => {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [
      file,
    ]);
  });
  logger.info({ file }, "Applied migration");
}

async function main() {
  const statusOnly = process.argv.includes("--status");
  await ensureSchemaMigrationsTable();
  const applied = await getApplied();
  const files = await listMigrationFiles();
  const pending = files.filter((f) => !applied.has(f));

  if (statusOnly) {
    logger.info({ applied: [...applied], pending }, "Migration status");
    return;
  }

  if (pending.length === 0) {
    logger.info("No pending migrations.");
    return;
  }

  for (const file of pending) await apply(file);
  logger.info({ count: pending.length }, "Migrations complete.");
}

main()
  .catch((err) => {
    logger.error({ err }, "Migration failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdownPool();
  });
