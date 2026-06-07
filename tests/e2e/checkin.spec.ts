// ===========================================================================
// checkin.spec.ts — T034 [US2] timed first-time check-in (SC-002 smoke).
//
// Drives the real /c/{slug}?k={code} scan landing against the dev server + the
// local Supabase stack. A fresh browser context = a fresh anonymous patron, so
// this is a true first-time check-in: scan → 'Stamped at The Heron.' with the
// ProgressMeter + a wallet CTA, all under the 60s SC-002 budget.
//
// The seeded demo business (helpers SEED): slug `the-heron`, current code
// `demo-heron-code-v1`. Requires the stack running with migrations + seed
// applied — see tests/e2e/.env-note.md.
//
// Default project is chromium (timed assertions). A `slow3g` project exists for
// the throttled 3G read; run it explicitly with --project=slow3g.
// ===========================================================================
import { test, expect } from "@playwright/test";

test("first-time scan stamps The Heron under 60s (SC-002)", async ({ page }) => {
  const started = Date.now();

  await page.goto("/c/the-heron?k=demo-heron-code-v1");

  // The stamped confirmation headline appears (server commits the stamp before
  // render — the durable-record guarantee).
  await expect(page.getByText("Stamped at The Heron.")).toBeVisible({ timeout: 10_000 });

  const elapsed = Date.now() - started;
  expect(elapsed, `first check-in took ${elapsed}ms`).toBeLessThan(60_000);

  // Progress meter is shown (the perk-progress surface).
  await expect(page.locator(".gl-progress")).toBeVisible();

  // A primary CTA is present (add to passport / wallet).
  await expect(page.getByRole("button", { name: /passport|wallet/i }).first()).toBeVisible();
});
