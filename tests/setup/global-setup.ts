// ============================================================
// global-setup.ts — every `vitest run` starts from the seeded baseline.
//
// WHY: suites legitimately mutate shared seed fixtures (rename the demo
// business, suspend it, redeem its perk). Restoring state per-suite proved
// order-fragile — runs were green from a fresh seed and rotted on accumulated
// state. One `supabase db reset` per invocation makes local behavior identical
// to CI (which resets once per job) and kills the whole flake class.
//
// Skip for fast single-file iteration: SKIP_DB_RESET=1 npx vitest run <file>
// (Lock-aware: cooperates with the /tmp/gl-db-lock mutex used by agents.)
// execFileSync with static argv (no shell, no interpolation).
// ============================================================
import { execFileSync } from "node:child_process";
import { mkdirSync, rmdirSync } from "node:fs";

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export default function globalSetup(): void {
  if (process.env.SKIP_DB_RESET === "1") {
    console.log("[global-setup] SKIP_DB_RESET=1 — running against current DB state");
    return;
  }

  // Cooperative lock (same protocol as the implementation agents).
  const lock = "/tmp/gl-db-lock";
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      if (Date.now() > deadline) throw new Error("[global-setup] timed out waiting for db lock");
      sleepSync(2000);
    }
  }

  try {
    execFileSync("supabase", ["status"], { stdio: "ignore" });
  } catch {
    rmdirSync(lock);
    throw new Error(
      "[global-setup] Supabase local stack is not running. Start it with `supabase start` " +
        "(or set SKIP_DB_RESET=1 to run against existing state).",
    );
  }

  try {
    console.log("[global-setup] supabase db reset — seeding the baseline…");
    execFileSync("supabase", ["db", "reset"], { stdio: "pipe", timeout: 180_000 });
  } finally {
    rmdirSync(lock);
  }
}
