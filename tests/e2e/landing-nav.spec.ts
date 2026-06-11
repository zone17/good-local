// ===========================================================================
// landing-nav.spec.ts — anchor navigation on the marketing landing.
//
// Regression guard for the sticky-header clip bug (D-027): clicking an in-page
// nav link (#how, #business) must scroll the target section so its heading
// lands *below* the sticky header, never clipped underneath it. The fix is
// scroll-margin-top on the anchored sections; this test fails if that offset
// regresses.
// ===========================================================================
import { test, expect } from "@playwright/test";

const CASES = [
  { link: /^For business$/, heading: /your loyalty program, live today/i },
  { link: /^How it works$/, heading: /a stamp for every visit/i },
] as const;

test.describe("landing anchor nav clears the sticky header", () => {
  test.use({ viewport: { width: 1200, height: 900 } });

  for (const { link, heading } of CASES) {
    test(`'${link.source}' lands its heading below the header`, async ({ page }) => {
      await page.goto("/");
      await page.getByRole("link", { name: link }).first().click();
      await page.waitForTimeout(600); // let the anchor scroll settle

      const h = page.getByRole("heading", { name: heading });
      await expect(h).toBeVisible();

      const box = await h.boundingBox();
      const headerH = await page
        .locator("header")
        .first()
        .evaluate((el) => el.getBoundingClientRect().height);

      // The heading's top must sit at or below the sticky header's bottom edge
      // (allow 1px rounding). If it regresses, the heading is clipped underneath.
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(headerH - 1);
    });
  }
});

test.describe("landing mobile menu (a11y)", () => {
  test.use({ viewport: { width: 420, height: 800 } });

  test("burger opens the menu, Escape closes it and returns focus", async ({ page }) => {
    await page.goto("/");
    const menu = page.locator("#gl-mobile-menu");
    await expect(menu).toHaveCount(0);

    await page.getByRole("button", { name: /open menu/i }).click();
    await expect(menu).toBeVisible();
    expect(await page.getByRole("button", { name: /close menu/i }).getAttribute("aria-expanded")).toBe("true");

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    const focusLabel = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
    expect(focusLabel).toMatch(/menu/i); // focus returned to the burger
  });
});
