import { test, expect } from "vitest";

// Trivial smoke test — proves the vitest runner is wired and collecting.
// Real coverage lives in tests/contract, tests/integration, tests/e2e.
test("vitest harness is alive", () => {
  expect(true).toBe(true);
});
