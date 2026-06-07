import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/contract/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/unit/**/*.test.ts",
    ],
    environment: "node",
    testTimeout: 15000,
    // Integration tests share one local DB — run files sequentially so fixture
    // arrangement and RLS assertions never race each other.
    fileParallelism: false,
    pool: "threads",
    poolOptions: {
      threads: { singleThread: true },
    },
  },
});
