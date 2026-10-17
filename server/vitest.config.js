import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.js"],
    sequence: {
      concurrent: false,
    },
    include: ["tests/**/*.test.js"],
    exclude: ["tests/**/*.integration.test.js", "node_modules/**"],
  },
});
