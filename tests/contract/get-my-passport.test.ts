// ===========================================================================
// get-my-passport.test.ts — T041 [US4] contract tests for get_my_passport.
//
// Validates the grouped passport-home shape (contract §2.4): patron identity,
// per-business stamp groups with real dates + perk progress (incl. the ready
// flag), and season regional progress with milestones. Fail-first per Art. XIX.
//
// Arrangement (service role) builds a patron with stamps at TWO businesses in
// TWO towns — The Heron (seeded, Narrowsburg) and a second business arranged in
// Barryville — plus mid-progress on each business's perk. With only 2 towns
// visited and the lowest milestone threshold at 4 (seed: Four Towns), NO
// milestone unlocks: the region.milestones array stays empty.
//
// The passport is read under the patron's own anon JWT (the real RPC path); the
// service-role client only arranges fixtures and reads patron ids.
//
// Requires the local stack with migrations + seed applied:
//   supabase db reset
//   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
//   npx vitest run tests/contract/get-my-passport.test.ts
// ===========================================================================
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import { SEED, serviceClient, anonPatronClient } from "../integration/helpers";

let svc: SupabaseClient;
let seasonId: string;
let serverToday: string;
let heronCodeId: string;

// Second business arranged for the multi-town case.
let barrylvilleTownId: string;
let secondBusinessId: string;
const SECOND_SLUG = "the-eddy";
let secondCodeId: string;
let secondPerkId: string;
let heronPerkId: string;

function daysAgo(n: number): string {
  const d = new Date(`${serverToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function ensurePatron(userId: string): Promise<string> {
  const existing = await svc.from("patrons").select("id").eq("auth_user_id", userId).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;
  const { data, error } = await svc
    .from("patrons")
    .insert({ auth_user_id: userId, display_name: "River", claimed_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !data) throw new Error(`ensurePatron failed: ${error?.message}`);
  return data.id as string;
}

beforeAll(async () => {
  svc = serviceClient();

  {
    const { data, error } = await svc.from("seasons").select("id, region_id").eq("is_current", true).single();
    if (error || !data) throw new Error(`no current season: ${error?.message}`);
    seasonId = data.id as string;
  }
  {
    const { data } = await svc.rpc("current_local_date");
    serverToday = data as string;
  }
  {
    const { data, error } = await svc
      .from("check_in_codes")
      .select("id")
      .eq("business_id", SEED.businessId)
      .eq("status", "current")
      .single();
    if (error || !data) throw new Error(`no current code: ${error?.message}`);
    heronCodeId = data.id as string;
  }
  {
    const { data, error } = await svc
      .from("perks")
      .select("id")
      .eq("business_id", SEED.businessId)
      .eq("status", "active")
      .order("visit_threshold", { ascending: true })
      .limit(1)
      .single();
    if (error || !data) throw new Error(`no heron perk: ${error?.message}`);
    heronPerkId = data.id as string;
  }

  // Arrange a second active business in Barryville (distinct town).
  {
    const { data: town, error } = await svc.from("towns").select("id").eq("slug", "barryville").single();
    if (error || !town) throw new Error(`no barryville town: ${error?.message}`);
    barrylvilleTownId = town.id as string;

    const { data: region } = await svc.from("regions").select("id").eq("slug", SEED.regionSlug).single();

    const { data: biz, error: bizErr } = await svc
      .from("businesses")
      .upsert(
        {
          region_id: region!.id,
          town_id: barrylvilleTownId,
          owner_user_id: SEED.ownerUserId,
          name: "The Eddy",
          slug: SECOND_SLUG,
          category: "cafe",
          hours: { text: "Daily 7-3" },
          owner_note: "Come for the slow morning.",
          stamp_code: "EDY",
          status: "active",
          approved_at: new Date().toISOString(),
          approved_by: SEED.adminUserId,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (bizErr || !biz) throw new Error(`second business arrange failed: ${bizErr?.message}`);
    secondBusinessId = biz.id as string;

    const { data: perk, error: perkErr } = await svc
      .from("perks")
      .upsert(
        {
          business_id: secondBusinessId,
          name: "Free pastry",
          description: "Your sixth visit, on us",
          visit_threshold: 6,
          kind: "off_peak_treat",
          status: "active",
        },
        { onConflict: "id", ignoreDuplicates: false },
      )
      .select("id")
      .single();
    // upsert without a conflict target on a generated PK just inserts; if the
    // perk already exists from a prior run, fetch it.
    if (perkErr || !perk) {
      const { data: existing } = await svc
        .from("perks")
        .select("id")
        .eq("business_id", secondBusinessId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      secondPerkId = existing!.id as string;
    } else {
      secondPerkId = perk.id as string;
    }

    const { data: code, error: codeErr } = await svc
      .from("check_in_codes")
      .upsert(
        { business_id: secondBusinessId, value: "demo-eddy-code-v1", version: 1, status: "current" },
        { onConflict: "value" },
      )
      .select("id")
      .single();
    if (codeErr || !code) throw new Error(`second code arrange failed: ${codeErr?.message}`);
    secondCodeId = code.id as string;
  }
});

describe("get_my_passport — empty passport for a never-scanned patron (D-024)", () => {
  it("a fresh anon session with no patron row returns an empty passport, not UNAUTHENTICATED", async () => {
    const { client } = await anonPatronClient();
    const { data, error } = await client.rpc("get_my_passport");
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(Array.isArray(data.businesses)).toBe(true);
    expect(data.businesses).toHaveLength(0);
    expect(data.region.towns_visited).toBe(0);
    expect(typeof data.region.towns_total).toBe("number");
    expect(data.patron.claimed).toBe(false);
  });

  it("no session at all still raises UNAUTHENTICATED", async () => {
    // Bare anon-key client with no user JWT — auth.uid() is null.
    const bare = (await import("@supabase/supabase-js")).createClient(
      process.env.SUPABASE_URL ?? process.env.API_URL ?? "http://127.0.0.1:54321",
      process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? "",
      { auth: { persistSession: false } },
    );
    const { error } = await bare.rpc("get_my_passport");
    expect(error).not.toBeNull();
    expect(error!.message).toContain("UNAUTHENTICATED");
  });
});

describe("get_my_passport (contract §2.4)", () => {
  it("returns the grouped passport shape across two businesses / two towns", async () => {
    const { client, userId } = await anonPatronClient();
    const patronId = await ensurePatron(userId);

    // The Heron: 3 valid stamps on distinct past dates (perk threshold 5).
    const heronRows = [3, 2, 1].map((d) => ({
      patron_id: patronId,
      business_id: SEED.businessId,
      season_id: seasonId,
      local_date: daysAgo(d),
      code_version_ref: heronCodeId,
      trust_valid: true,
    }));
    // The Eddy: 2 valid stamps (perk threshold 6).
    const eddyRows = [5, 4].map((d) => ({
      patron_id: patronId,
      business_id: secondBusinessId,
      season_id: seasonId,
      local_date: daysAgo(d),
      code_version_ref: secondCodeId,
      trust_valid: true,
    }));
    const ins = await svc.from("stamps").insert([...heronRows, ...eddyRows]);
    expect(ins.error).toBeNull();

    const { data, error } = await client.rpc("get_my_passport");
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    // patron identity
    expect(data.patron.id).toBe(patronId);
    expect(data.patron.display_name).toBe("River");
    expect(data.patron.claimed).toBe(true);

    // businesses grouped (2 of them)
    expect(Array.isArray(data.businesses)).toBe(true);
    expect(data.businesses).toHaveLength(2);

    const heron = data.businesses.find((b: any) => b.business_slug === SEED.businessSlug);
    const eddy = data.businesses.find((b: any) => b.business_slug === SECOND_SLUG);
    expect(heron).toBeTruthy();
    expect(eddy).toBeTruthy();

    // Heron group
    expect(heron.name).toBe("The Heron");
    expect(heron.stamp_code).toBe("HRN"); // registered code, never derived initials (§2.4, 2026-06-07)
    expect(heron.town).toBe("Narrowsburg");
    expect(heron.stamp_count).toBe(3);
    expect(Array.isArray(heron.stamp_dates)).toBe(true);
    expect(heron.stamp_dates).toHaveLength(3);
    // stamp_dates ascending
    const sorted = [...heron.stamp_dates].sort();
    expect(heron.stamp_dates).toEqual(sorted);
    expect(Array.isArray(heron.perks)).toBe(true);
    const heronPerk = heron.perks[0];
    expect(heronPerk.perk_id).toBe(heronPerkId);
    expect(heronPerk.name).toBe("The Regular's Pour");
    expect(heronPerk.current).toBe(3);
    expect(heronPerk.threshold).toBe(5);
    expect(heronPerk.ready).toBe(false);

    // Eddy group
    expect(eddy.town).toBe("Barryville");
    expect(eddy.stamp_count).toBe(2);
    expect(eddy.perks[0].perk_id).toBe(secondPerkId);
    expect(eddy.perks[0].current).toBe(2);
    expect(eddy.perks[0].threshold).toBe(6);
    expect(eddy.perks[0].ready).toBe(false);

    // region: 2 of 12 towns, no milestone unlocked (lowest threshold = 4)
    expect(data.region.towns_visited).toBe(2);
    expect(data.region.towns_total).toBe(12);
    expect(Array.isArray(data.region.milestones)).toBe(true);
    expect(data.region.milestones).toHaveLength(0);
  });

  it("ready flag is true once a perk threshold is reached", async () => {
    const { client, userId } = await anonPatronClient();
    const patronId = await ensurePatron(userId);

    // 5 valid stamps at The Heron (threshold 5) → ready.
    const rows = [5, 4, 3, 2, 1].map((d) => ({
      patron_id: patronId,
      business_id: SEED.businessId,
      season_id: seasonId,
      local_date: daysAgo(d),
      code_version_ref: heronCodeId,
      trust_valid: true,
    }));
    const ins = await svc.from("stamps").insert(rows);
    expect(ins.error).toBeNull();

    const { data, error } = await client.rpc("get_my_passport");
    expect(error).toBeNull();
    const heron = data.businesses.find((b: any) => b.business_slug === SEED.businessSlug);
    expect(heron.stamp_count).toBe(5);
    expect(heron.perks[0].ready).toBe(true);
  });

  it("UNAUTHENTICATED when called without a session", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL ?? process.env.API_URL ?? "http://127.0.0.1:54321";
    const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? "";
    const bare = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await bare.rpc("get_my_passport");
    expect(error).not.toBeNull();
    expect(error!.message).toContain("UNAUTHENTICATED");
  });
});

afterAll(async () => {
  // Arranged fixtures (second business + its perk/code/stamps) persist in the
  // ephemeral test DB; the next `supabase db reset` clears them. Anon patrons
  // are ephemeral fixture rows.
});
