import { afterAll } from "vitest";
import { shutdownPool } from "../src/config/db.js";

afterAll(async () => {
  // This prevents the test runner from hanging
  await shutdownPool();
});
