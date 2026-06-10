// ===========================================================================
// region-interest.spec.ts — "bring Good Local to your region" lead capture.
//
// Drives the public form in the landing's movement section, asserts the
// thank-you state, verifies the row landed (service client), and asserts the
// RLS security property: anon CANNOT read region_interest back (admin-only).
// ===========================================================================
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

function statusEnv(): { url: string; serviceKey: string; anonKey: string } {
  let url = process.env.SUPABASE_URL ?? process.env.API_URL ?? "";
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? "";
  let anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? "";
  if (!url || !serviceKey || !anonKey) {
    try {
      const raw = execSync("supabase status -o env", { encoding: "utf8" });
      const get = (k: string) =>
        raw.split("\n").find((l) => l.startsWith(`${k}=`))?.split("=").slice(1).join("=").replace(/^"|"$/g, "");
      url = url || get("API_URL") || "http://127.0.0.1:54321";
      serviceKey = serviceKey || get("SERVICE_ROLE_KEY") || "";
      anonKey = anonKey || get("ANON_KEY") || "";
    } catch {
      url = url || "http://127.0.0.1:54321";
    }
  }
  return { url, serviceKey, anonKey };
}

const { url: SUPABASE_URL, serviceKey: SERVICE_ROLE_KEY, anonKey: ANON_KEY } = statusEnv();

test.describe("region interest capture", () => {
  test.use({ viewport: { width: 1200, height: 900 } });

  test("form writes a row and shows a thank-you; anon cannot read it back", async ({ page }) => {
    expect(SERVICE_ROLE_KEY, "service-role key required").toBeTruthy();
    const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const stamp = Date.now();
    const region = `Beacon NY ${stamp}`;
    const email = `e2e.region.${stamp}@example.com`;

    await page.goto("/");
    await page.getByPlaceholder("Your town or region").fill(region);
    await page.getByPlaceholder("you@email.com").fill(email);
    await page.getByRole("button", { name: /request your region/i }).click();

    await expect(page.getByText(/thank you/i)).toBeVisible({ timeout: 10_000 });

    // The row landed with the submitted values.
    const { data } = await svc.from("region_interest").select("region,email").eq("email", email);
    expect(data ?? []).toHaveLength(1);
    expect(data?.[0]?.region).toBe(region);

    // RLS: anon must NOT be able to read the table back (admin-only select).
    if (ANON_KEY) {
      const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
      const { data: leak } = await anon.from("region_interest").select("email").eq("email", email);
      expect(leak ?? [], "anon must not read region_interest").toHaveLength(0);
    }

    await svc.from("region_interest").delete().eq("email", email);
  });
});
