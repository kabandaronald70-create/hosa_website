import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.js"],
    sequence: {
      concurrent: false,
    },
    include: ["tests/**/*.integration.test.js"],
  },
});
