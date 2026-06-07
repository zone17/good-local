// ===========================================================================
// a11y.spec.ts — T060 accessibility audit (Constitution Art. IX).
//
// Runs an axe-core AA scan over the four anonymous-context surfaces and asserts
// zero serious/critical violations on each. Lower-impact findings are reported
// as console warnings (report-and-pass) rather than failing the build, so the
// gate stays focused on the impacts that actually block people.
//
// Surfaces (all driven against the dev server on :5173, reuseExistingServer):
//   1. /c/the-heron?k=demo-heron-code-v1  — post-stamp check-in success state.
//   2. /                                  — patron passport home (anonymous).
//   3. /business                          — owner dashboard (DEV mock render).
//   4. /admin                             — admin sign-in screen (signed out).
//
// Tap-target floors (design/SKILL.md): every visible button/link on the
// check-in success screen is >=44x44; the wallet CTA is >=64 tall.
//
// Requires the local stack running with migrations + seed applied (the check-in
// surface commits a real stamp). See tests/e2e/.env-note.md.
// ===========================================================================
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// AA scope: WCAG 2.0/2.1 level A + AA rule tags. Best-practice rules are left
// out of the failing gate (they surface as warnings via the impact filter).
const AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const BLOCKING = new Set(["serious", "critical"]);

// Run the AA scan, fail on serious/critical, warn on the rest.
async function auditAA(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(AA_TAGS).analyze();

  const blocking = results.violations.filter((v) => BLOCKING.has(v.impact ?? ""));
  const minor = results.violations.filter((v) => !BLOCKING.has(v.impact ?? ""));

  for (const v of minor) {
    const nodes = v.nodes.map((n) => n.target.join(" ")).join("; ");
    // eslint-disable-next-line no-console
    console.warn(`[a11y warn] ${label}: (${v.impact}) ${v.id} — ${v.help}\n    ${nodes}`);
  }

  const report = blocking
    .map((v) => {
      const nodes = v.nodes.map((n) => `      ${n.target.join(" ")}`).join("\n");
      return `  (${v.impact}) ${v.id} — ${v.help}\n${nodes}`;
    })
    .join("\n");

  expect(blocking, `${label} serious/critical a11y violations:\n${report}`).toEqual([]);
}

test.describe("accessibility — AA, anonymous contexts (Art. IX)", () => {
  test("check-in success state has no serious/critical violations (SC-002 surface)", async ({ page }) => {
    await page.goto("/c/the-heron?k=demo-heron-code-v1");
    await expect(page.getByText("Stamped at The Heron.")).toBeVisible({ timeout: 10_000 });
    await auditAA(page, "/c (check-in success)");
  });

  test("patron passport home has no serious/critical violations", async ({ page }) => {
    await page.goto("/");
    // Either the loaded passport or its loading shell counts as rendered; the
    // axe scan runs on whatever anonymous state the app settles into.
    await expect(page.getByText(/Passport/i).first()).toBeVisible({ timeout: 10_000 });
    await auditAA(page, "/ (passport home)");
  });

  test("business surface has no serious/critical violations", async ({ page }) => {
    await page.goto("/business");
    await page.waitForLoadState("networkidle");
    await auditAA(page, "/business");
  });

  test("admin sign-in screen has no serious/critical violations", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible({ timeout: 10_000 });
    await auditAA(page, "/admin (sign-in)");
  });

  test("check-in success tap targets meet the 44/64px floors (SKILL.md)", async ({ page }) => {
    await page.goto("/c/the-heron?k=demo-heron-code-v1");
    await expect(page.getByText("Stamped at The Heron.")).toBeVisible({ timeout: 10_000 });

    const targets = page.locator("button:visible, a:visible");
    const count = await targets.count();
    expect(count, "the success screen renders at least one CTA").toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const el = targets.nth(i);
      const box = await el.boundingBox();
      const text = ((await el.textContent()) ?? "").trim();
      expect(box, `tap target "${text}" has a bounding box`).not.toBeNull();
      if (!box) continue;

      // 44px floor on both axes for every actionable element.
      expect(box.width, `tap target "${text}" width >= 44`).toBeGreaterThanOrEqual(44);
      expect(box.height, `tap target "${text}" height >= 44`).toBeGreaterThanOrEqual(44);

      // The wallet CTA gets the 64px height floor (outdoor / wet-hand hero action).
      if (/wallet|passport to apple/i.test(text)) {
        expect(box.height, `wallet CTA "${text}" height >= 64`).toBeGreaterThanOrEqual(64);
      }
    }
  });
});
