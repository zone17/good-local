// ===========================================================================
// steer-attribution.spec.ts — T048 [US5] steer-capture e2e (SC-006).
//
// SCOPE NOTE — what this proves vs. what is proven elsewhere:
//   SC-006 ("a surfaced→first-visit attributes as steered ≥95%") has two moving
//   parts: (1) the impression-CAPTURE pipeline — discovery render writes a
//   steer_impression linked to the SAME patron identity that later stamps; and
//   (2) the day-boundary ATTRIBUTION join — an impression strictly before the
//   first valid stamp marks that first visit steered. Part (2) needs a cross-day
//   clock and is NOT feasible in an e2e: it is covered SQL-level by the
//   record_check_in contract test (record-check-in.test.ts case 7 — impression
//   yesterday → steered:true today) and by the gate view
//   gate_steered_first_visit_rate (0003_views.sql, local_date < first_date).
//
//   THIS e2e proves part (1) — the capture pipeline, the SC-006 moving part the
//   UI owns: a fresh patron opening Discover writes one steer_impression per
//   visible business, all linked to that patron (≥95% fidelity → here, 3 of 3
//   visible businesses produce 3 rows under one patron_id).
//
// Reuses the dev server on :5173 (playwright.config webServer, reuseExistingServer).
// Requires the local stack with migrations + seed applied + service-role key
// reachable via `supabase status -o env` (see tests/e2e/.env-note.md).
// ===========================================================================
import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

function statusEnv(): { url: string; serviceKey: string } {
  // Prefer an already-exported env (the FINISH step exports these); fall back to
  // `supabase status -o env` so the spec is self-contained when run directly.
  let url = process.env.SUPABASE_URL ?? process.env.API_URL ?? "";
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) {
    try {
      const raw = execSync("supabase status -o env", { encoding: "utf8" });
      const get = (k: string) =>
        raw.split("\n").find((l) => l.startsWith(`${k}=`))?.split("=").slice(1).join("=").replace(/^"|"$/g, "");
      url = url || get("API_URL") || "http://127.0.0.1:54321";
      serviceKey = serviceKey || get("SERVICE_ROLE_KEY") || "";
    } catch {
      url = url || "http://127.0.0.1:54321";
    }
  }
  return { url, serviceKey };
}

const { url: SUPABASE_URL, serviceKey: SERVICE_ROLE_KEY } = statusEnv();

const REGION_SLUG = "upper-delaware";
const OWNER_USER = "00000000-0000-0000-0000-0000000000a1";
const ADMIN_USER = "00000000-0000-0000-0000-0000000000ad";

// Three discovery-visible businesses we assert impressions for (The Heron is
// seeded; we add two more active businesses in distinct towns).
const TARGETS = [
  { slug: "the-heron", town: "narrowsburg" }, // seeded
  { slug: "steer-eddy", town: "barryville", name: "Steer Eddy", code: "SEY" },
  { slug: "steer-mill", town: "callicoon", name: "Steer Mill", code: "SML" },
];

let svc: SupabaseClient;
const targetIds: Record<string, string> = {};

test.beforeAll(async () => {
  expect(SERVICE_ROLE_KEY, "service-role key required (supabase status -o env)").toBeTruthy();
  svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: region } = await svc.from("regions").select("id").eq("slug", REGION_SLUG).single();

  for (const t of TARGETS) {
    if (t.name) {
      const { data: town } = await svc.from("towns").select("id").eq("slug", t.town).single();
      await svc
        .from("businesses")
        .upsert(
          {
            region_id: region!.id,
            town_id: town!.id,
            owner_user_id: OWNER_USER,
            name: t.name,
            slug: t.slug,
            category: "cafe",
            hours: { text: "Daily" },
            stamp_code: t.code,
            status: "active",
            approved_at: new Date().toISOString(),
            approved_by: ADMIN_USER,
          },
          { onConflict: "slug" },
        );
    }
    const { data: biz } = await svc.from("businesses").select("id").eq("slug", t.slug).single();
    targetIds[t.slug] = biz!.id as string;
  }

  // Clear any pre-existing impressions for the target businesses (other suites
  // sharing this DB may have logged some), so THIS fresh-patron run's rows are
  // the only ones and the single-patron linkage assertion is exact.
  await svc.from("steer_impressions").delete().in("business_id", Object.values(targetIds));
});

test("Discover render captures one steer_impression per visible business, linked to the patron (SC-006 capture)", async ({ page }) => {
  // Count record_impressions RPC calls fired by the Discover render.
  let impressionCalls = 0;
  await page.route("**/rest/v1/rpc/record_impressions", async (route) => {
    impressionCalls += 1;
    await route.continue();
  });

  // Fresh context (new anon patron) → open the patron app, then Discover.
  await page.goto("/");
  await page.getByRole("button", { name: /Discover/i }).click();

  // The discovery list renders (founding-pick eyebrow / cards). Wait for the
  // impressions RPC to fire (batched once per render).
  await expect.poll(() => impressionCalls, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);

  // Give the batched insert a moment to commit, then assert DB-side.
  const ids = TARGETS.map((t) => targetIds[t.slug]);
  await expect
    .poll(
      async () => {
        const { data } = await svc
          .from("steer_impressions")
          .select("patron_id, business_id")
          .in("business_id", ids);
        return (data ?? []).length;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(3);

  // All three target rows exist and share ONE patron_id (correct linkage).
  const { data: rows } = await svc
    .from("steer_impressions")
    .select("patron_id, business_id")
    .in("business_id", ids);

  const byBusiness = new Set((rows ?? []).map((r) => r.business_id));
  for (const id of ids) {
    expect(byBusiness.has(id), `impression row for business ${id}`).toBe(true);
  }

  const patrons = new Set((rows ?? []).map((r) => r.patron_id));
  // ≥95% fidelity: every captured impression in this fresh run is linked to the
  // single bootstrapped patron identity (exactly one distinct patron_id).
  expect(patrons.size).toBe(1);
});
