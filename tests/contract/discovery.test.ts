// ===========================================================================
// discovery.test.ts — T045 [US5] contract tests for the discovery surface.
//
// Covers contract §§2.5, 2.6, 2.2:
//   - get_discovery: towns[] with picks[]; curated rows carry curation_label
//     'Founding Pick'; regulars_this_season comes from the verified-regulars
//     view; regulars_empty is true at zero. Art. I: NO ordering params exist —
//     calling with {p_sort} must error (unknown argument).
//   - get_business_detail: §2.6 shape incl. my_progress for the calling patron.
//   - record_impressions: §2.2 {recorded, deduped} with per-day server dedup.
//     (record_impressions already lives in 0006 — exercised, not redefined.)
//
// Fail-first per Art. XIX (get_discovery / get_business_detail land in 0009).
//
// Requires the local stack with migrations + seed applied:
//   supabase db reset
//   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
//   npx vitest run tests/contract/discovery.test.ts
// ===========================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import { SEED, serviceClient, anonPatronClient } from "../integration/helpers";

let svc: SupabaseClient;
let seasonId: string;
let serverToday: string;
let heronCodeId: string;

function daysAgo(n: number): string {
  const d = new Date(`${serverToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function ensurePatron(userId: string): Promise<string> {
  const existing = await svc.from("patrons").select("id").eq("auth_user_id", userId).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;
  const { data, error } = await svc.from("patrons").insert({ auth_user_id: userId }).select("id").single();
  if (error || !data) throw new Error(`ensurePatron failed: ${error?.message}`);
  return data.id as string;
}

beforeAll(async () => {
  svc = serviceClient();
  {
    const { data, error } = await svc.from("seasons").select("id").eq("is_current", true).single();
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

  // Curate The Heron as a founding pick in Narrowsburg (service role).
  {
    const { data: town } = await svc.from("towns").select("id").eq("slug", "narrowsburg").single();
    await svc
      .from("founding_picks")
      .upsert(
        { town_id: town!.id, business_id: SEED.businessId, curated_by: SEED.adminUserId, display_order: 1 },
        { onConflict: "town_id,business_id" },
      );

    // Arrange a verified regular at The Heron: one patron with 2 trust-valid
    // stamps in-season (the view counts this as 1 verified regular).
    const { data: p } = await svc.from("patrons").insert({}).select("id").single();
    await svc.from("stamps").insert([
      {
        patron_id: p!.id,
        business_id: SEED.businessId,
        season_id: seasonId,
        local_date: daysAgo(2),
        code_version_ref: heronCodeId,
        trust_valid: true,
      },
      {
        patron_id: p!.id,
        business_id: SEED.businessId,
        season_id: seasonId,
        local_date: daysAgo(1),
        code_version_ref: heronCodeId,
        trust_valid: true,
      },
    ]);
  }
});

describe("get_discovery (contract §2.5)", () => {
  it("returns towns[] with picks[]; founding picks carry the 'Founding Pick' label + view-sourced counter", async () => {
    const { client } = await anonPatronClient();
    const { data, error } = await client.rpc("get_discovery", { p_town: null });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(Array.isArray(data.towns)).toBe(true);

    const narrowsburg = data.towns.find((t: any) => t.town === "Narrowsburg");
    expect(narrowsburg).toBeTruthy();
    expect(Array.isArray(narrowsburg.picks)).toBe(true);

    const heron = narrowsburg.picks.find((p: any) => p.business_slug === SEED.businessSlug);
    expect(heron).toBeTruthy();
    expect(heron.name).toBe("The Heron");
    expect(heron.curation_label).toBe("Founding Pick");
    // verified-regulars view: the arranged 2-stamp patron counts as a regular.
    // (>=1 — other contract tests sharing this DB session may add more regulars;
    // what matters is the counter is view-sourced and non-empty.)
    expect(heron.regulars_this_season).toBeGreaterThanOrEqual(1);
    expect(heron.regulars_empty).toBe(false);
  });

  it("regulars_empty is true when a business has zero verified regulars", async () => {
    // The Eddy (no stamps) — arrange an active, un-curated business.
    const { data: town } = await svc.from("towns").select("id").eq("slug", "callicoon").single();
    const { data: region } = await svc.from("regions").select("id").eq("slug", SEED.regionSlug).single();
    await svc
      .from("businesses")
      .upsert(
        {
          region_id: region!.id,
          town_id: town!.id,
          owner_user_id: SEED.ownerUserId,
          name: "Quiet Spot",
          slug: "quiet-spot",
          category: "shop",
          hours: { text: "Fri-Sun" },
          stamp_code: "QSP",
          status: "active",
          approved_at: new Date().toISOString(),
          approved_by: SEED.adminUserId,
        },
        { onConflict: "slug" },
      );

    const { client } = await anonPatronClient();
    const { data, error } = await client.rpc("get_discovery", { p_town: "Callicoon" });
    expect(error).toBeNull();
    const callicoon = data.towns.find((t: any) => t.town === "Callicoon");
    expect(callicoon).toBeTruthy();
    const quiet = callicoon.picks.find((p: any) => p.business_slug === "quiet-spot");
    expect(quiet).toBeTruthy();
    expect(quiet.regulars_this_season).toBe(0);
    expect(quiet.regulars_empty).toBe(true);
  });

  it("Art. I: no ordering params — passing p_sort errors (unknown argument)", async () => {
    const { client } = await anonPatronClient();
    const { error } = await client.rpc("get_discovery", { p_sort: "x" });
    expect(error).not.toBeNull();
  });
});

describe("get_business_detail (contract §2.6)", () => {
  it("returns the §2.6 shape incl. my_progress for the calling patron", async () => {
    const { client, userId } = await anonPatronClient();
    const patronId = await ensurePatron(userId);

    // Two valid stamps for this patron at The Heron → my_progress reflects them.
    await svc.from("stamps").insert([
      {
        patron_id: patronId,
        business_id: SEED.businessId,
        season_id: seasonId,
        local_date: daysAgo(3),
        code_version_ref: heronCodeId,
        trust_valid: true,
      },
      {
        patron_id: patronId,
        business_id: SEED.businessId,
        season_id: seasonId,
        local_date: daysAgo(2),
        code_version_ref: heronCodeId,
        trust_valid: true,
      },
    ]);

    const { data, error } = await client.rpc("get_business_detail", { p_business_slug: SEED.businessSlug });
    expect(error).toBeNull();
    expect(data.business_slug).toBe(SEED.businessSlug);
    expect(data.stamp_code).toBe("HRN"); // registered code for stamp rendering (§2.6, 2026-06-07)
    expect(data.name).toBe("The Heron");
    expect(data.town).toBe("Narrowsburg");
    expect(typeof data.category).toBe("string");
    expect(typeof data.owner_note).toBe("string");
    expect(typeof data.directions_url).toBe("string");
    expect(data.directions_url).toContain("https://maps.apple.com/");
    expect(typeof data.regulars_this_season).toBe("number");
    expect(typeof data.regulars_empty).toBe("boolean");

    expect(data.my_progress).toBeTruthy();
    expect(data.my_progress.stamp_count).toBe(2);
    expect(Array.isArray(data.my_progress.perks)).toBe(true);
    expect(data.my_progress.perks[0].current).toBe(2);
    expect(data.my_progress.perks[0].threshold).toBe(5);
  });

  it("my_progress is null when the patron has no stamps there", async () => {
    const { client } = await anonPatronClient();
    const { data, error } = await client.rpc("get_business_detail", { p_business_slug: SEED.businessSlug });
    expect(error).toBeNull();
    expect(data.my_progress).toBeNull();
  });

  it("BUSINESS_NOT_FOUND for an unknown slug", async () => {
    const { client } = await anonPatronClient();
    const { error } = await client.rpc("get_business_detail", { p_business_slug: "no-such-business" });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("BUSINESS_NOT_FOUND");
  });
});

describe("record_impressions (contract §2.2 — already in 0006, exercised here)", () => {
  it("records a batch and reports {recorded, deduped}", async () => {
    const { client } = await anonPatronClient();
    const { data, error } = await client.rpc("record_impressions", {
      p_business_ids: [SEED.businessId],
      p_surface: "discovery",
    });
    expect(error).toBeNull();
    expect(data.recorded).toBe(1);
    expect(data.deduped).toBe(0);
  });

  it("dedupes per patron × business × day on a repeat same-day call", async () => {
    const { client } = await anonPatronClient();
    const first = await client.rpc("record_impressions", {
      p_business_ids: [SEED.businessId],
      p_surface: "discovery",
    });
    expect(first.error).toBeNull();
    expect(first.data.recorded).toBe(1);

    const second = await client.rpc("record_impressions", {
      p_business_ids: [SEED.businessId],
      p_surface: "discovery",
    });
    expect(second.error).toBeNull();
    expect(second.data.recorded).toBe(0);
    expect(second.data.deduped).toBe(1);
  });

  it("accepts the business_detail surface", async () => {
    const { client } = await anonPatronClient();
    const { data, error } = await client.rpc("record_impressions", {
      p_business_ids: [SEED.businessId],
      p_surface: "business_detail",
    });
    expect(error).toBeNull();
    expect(data.recorded).toBe(1);
  });
});
