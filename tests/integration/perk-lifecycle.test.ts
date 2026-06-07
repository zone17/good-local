// ===========================================================================
// perk-lifecycle.test.ts — T040 [US3] FR-011 / FR-010 + redemption-reset.
//
// Proves the perk lifecycle invariants end-to-end against the live RPCs:
//   - threshold edit (5→7) preserves existing stamps; progress recomputes
//     prospectively (the stamps don't move; ready re-evaluates to the new bar).
//   - set_perk_active(false) leaves stamps untouched; reactivation restores
//     progress unchanged.
//   - post-redemption reset: redeem, then the NEXT stamp shows current 1 of
//     threshold (the since-last-redemption rule, 0007).
//
// A dedicated business + perk is arranged via service role so threshold edits
// here never disturb the shared seed perk used by other suites.
//
// Requires the local stack with migrations + seed applied.
// ===========================================================================
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SEED,
  serviceClient,
  ensureSeedAuthPasswords,
} from "./helpers";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.API_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? "";

const OWNER_C_EMAIL = `owner-pl-${crypto.randomUUID().slice(0, 8)}@test`;
const OWNER_C_PASSWORD = "test-password-owner-pl";

let svc: SupabaseClient;
let owner: SupabaseClient;
let businessId: string;
let perkId: string;
let codeId: string;
let seasonId: string;
let serverToday: string;

function daysAgo(n: number): string {
  const d = new Date(`${serverToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function perkProgress(patronId: string): Promise<number> {
  const { data, error } = await svc.rpc("perk_progress_count", {
    p_patron_id: patronId,
    p_perk_id: perkId,
  });
  if (error) throw new Error(`perk_progress_count: ${error.message}`);
  return data as number;
}

async function makePatronWithStamps(label: string, dates: string[]): Promise<string> {
  const { data: p } = await svc.from("patrons").insert({ display_name: label }).select("id").single();
  const patronId = p!.id as string;
  await svc.from("stamps").insert(
    dates.map((d) => ({
      patron_id: patronId,
      business_id: businessId,
      season_id: seasonId,
      local_date: d,
      code_version_ref: codeId,
      trust_valid: true,
    })),
  );
  return patronId;
}

beforeAll(async () => {
  svc = serviceClient();
  await ensureSeedAuthPasswords();

  {
    const { data } = await svc.from("seasons").select("id").eq("is_current", true).single();
    seasonId = data!.id as string;
  }
  {
    const { data } = await svc.rpc("current_local_date");
    serverToday = data as string;
  }

  // owner-c auth user.
  const created = await svc.auth.admin.createUser({
    email: OWNER_C_EMAIL,
    password: OWNER_C_PASSWORD,
    email_confirm: true,
  });
  let ownerCId = created.data?.user?.id;
  if (!ownerCId) {
    const list = await svc.auth.admin.listUsers();
    ownerCId = list.data.users.find((u) => u.email === OWNER_C_EMAIL)?.id;
  }
  if (!ownerCId) throw new Error("could not resolve owner-c id");

  const { data: town } = await svc.from("towns").select("id").eq("slug", "callicoon").single();

  const biz = await svc
    .from("businesses")
    .insert({
      region_id: SEED.regionId,
      town_id: town!.id,
      owner_user_id: ownerCId,
      name: "The Mill",
      slug: `the-mill-${crypto.randomUUID().slice(0, 6)}`,
      category: "cafe",
      stamp_code: "MIL",
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: SEED.adminUserId,
    })
    .select("id")
    .single();
  businessId = biz.data!.id as string;

  const perk = await svc
    .from("perks")
    .insert({
      business_id: businessId,
      name: "Mill Mug",
      description: "Fifth visit, on us",
      visit_threshold: 5,
      kind: "status_good",
      status: "active",
    })
    .select("id")
    .single();
  perkId = perk.data!.id as string;

  const code = await svc
    .from("check_in_codes")
    .insert({
      business_id: businessId,
      value: `mill-code-${crypto.randomUUID().slice(0, 6)}`,
      version: 1,
      status: "current",
    })
    .select("id")
    .single();
  codeId = code.data!.id as string;

  const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: OWNER_C_EMAIL, password: OWNER_C_PASSWORD });
  owner = c;
});

describe("perk lifecycle (FR-010, FR-011, redemption reset)", () => {
  it("threshold edit 5→7 preserves stamps; progress recomputes prospectively", async () => {
    // Patron at 5 stamps → ready under threshold 5.
    const patronId = await makePatronWithStamps("Threshold Edit", [1, 2, 3, 4, 5].map(daysAgo));
    expect(await perkProgress(patronId)).toBe(5);

    // Owner raises threshold to 7.
    const upd = await owner.rpc("update_perk", { p_perk_id: perkId, p_threshold: 7 });
    expect(upd.error).toBeNull();
    expect(upd.data.applies_prospectively).toBe(true);
    expect(upd.data.visit_threshold).toBe(7);

    // Stamps are untouched — count is still 5.
    expect(await perkProgress(patronId)).toBe(5);
    const { data: stamps } = await svc.from("stamps").select("id").eq("patron_id", patronId);
    expect(stamps!.length).toBe(5);

    // Restore threshold for downstream tests.
    await owner.rpc("update_perk", { p_perk_id: perkId, p_threshold: 5 });
  });

  it("set_perk_active(false) leaves stamps; reactivation restores progress", async () => {
    const patronId = await makePatronWithStamps("Deactivate", [10, 11, 12].map(daysAgo));
    expect(await perkProgress(patronId)).toBe(3);

    const off = await owner.rpc("set_perk_active", { p_perk_id: perkId, p_active: false });
    expect(off.error).toBeNull();

    // Stamps survive deactivation; the underlying count is unchanged.
    const { data: stamps } = await svc.from("stamps").select("id").eq("patron_id", patronId);
    expect(stamps!.length).toBe(3);
    expect(await perkProgress(patronId)).toBe(3);

    const on = await owner.rpc("set_perk_active", { p_perk_id: perkId, p_active: true });
    expect(on.error).toBeNull();
    expect(await perkProgress(patronId)).toBe(3);
  });

  it("post-redemption reset: redeem at threshold, next stamp shows 1 of threshold", async () => {
    // Patron at 5 stamps (threshold 5) → ready.
    const patronId = await makePatronWithStamps("Reset Patron", [20, 21, 22, 23, 24].map(daysAgo));
    expect(await perkProgress(patronId)).toBe(5);

    const red = await owner.rpc("redeem_perk", { p_patron_ref: patronId, p_perk_id: perkId });
    expect(red.error).toBeNull();
    expect(red.data.perk_progress.current).toBe(0);
    expect(red.data.perk_progress.ready).toBe(false);

    // Progress is now 0 (all 5 stamps precede the redemption).
    expect(await perkProgress(patronId)).toBe(0);

    // The next stamp (created AFTER the redemption) → progress 1 of 5.
    await svc.from("stamps").insert({
      patron_id: patronId,
      business_id: businessId,
      season_id: seasonId,
      local_date: serverToday,
      code_version_ref: codeId,
      trust_valid: true,
    });
    expect(await perkProgress(patronId)).toBe(1);
  });
});

afterAll(async () => {
  // Ephemeral test business/patrons remain in the local DB; harmless across runs.
});
