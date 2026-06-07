// ===========================================================================
// no-decay.test.ts — T044 [US4] no-decay / no-streak invariant (Art. VII).
//
// The passport never decays: stamps and milestone unlocks earned at any point in
// the season remain, in full, no matter how much time passes or how long the
// patron is absent. There are no streaks, no expiry, no "use it or lose it".
//
// We can't fast-forward the DB clock, so we simulate the passage of time by
// arranging stamps far in the past (early-season local_dates) AND a milestone
// unlock, then assert:
//   (a) get_my_passport counts every old stamp identically (no time-based drop);
//   (b) a previously-unlocked milestone stays unlocked;
//   (c) two reads taken apart are byte-identical (idempotent, no decay tick).
//
// Requires the local stack with migrations + seed applied:
//   supabase db reset
//   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
//   npx vitest run tests/integration/no-decay.test.ts
// ===========================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import { SEED, serviceClient, anonPatronClient } from "../integration/helpers";

let svc: SupabaseClient;
let seasonId: string;
let heronCodeId: string;
let fourTownsMilestoneId: string;

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
    const { data, error } = await svc.from("seasons").select("id, starts_on").eq("is_current", true).single();
    if (error || !data) throw new Error(`no current season: ${error?.message}`);
    seasonId = data.id as string;
  }
  {
    const { data } = await svc
      .from("check_in_codes")
      .select("id")
      .eq("business_id", SEED.businessId)
      .eq("status", "current")
      .single();
    heronCodeId = data!.id as string;
  }
  {
    const { data } = await svc
      .from("regional_milestones")
      .select("id")
      .eq("kind", "towns_visited")
      .eq("threshold", 4)
      .single();
    fourTownsMilestoneId = data!.id as string;
  }
});

describe("no-decay invariant (Art. VII)", () => {
  it("old stamps + an unlocked milestone persist; the read is stable over time", async () => {
    const { client, userId } = await anonPatronClient();
    const patronId = await ensurePatron(userId);

    // Arrange 3 trust-valid stamps at The Heron on early-season dates (far in the
    // "past") — simulating a patron who earned them long ago and stayed away.
    const earlyDates = ["2026-07-01", "2026-07-02", "2026-07-03"];
    const rows = earlyDates.map((d) => ({
      patron_id: patronId,
      business_id: SEED.businessId,
      season_id: seasonId,
      local_date: d,
      code_version_ref: heronCodeId,
      trust_valid: true,
    }));
    const ins = await svc.from("stamps").insert(rows);
    expect(ins.error).toBeNull();

    // Arrange a previously-unlocked milestone (Four Towns), unlocked early.
    await svc
      .from("milestone_unlocks")
      .upsert(
        { patron_id: patronId, milestone_id: fourTownsMilestoneId, unlocked_at: "2026-07-03T12:00:00Z" },
        { onConflict: "patron_id,milestone_id" },
      );

    // Read once.
    const first = await client.rpc("get_my_passport");
    expect(first.error).toBeNull();
    const heron1 = first.data.businesses.find((b: any) => b.business_slug === SEED.businessSlug);
    expect(heron1.stamp_count).toBe(3); // every old stamp still counts — no decay
    expect(heron1.stamp_dates).toEqual([...earlyDates].sort());

    // The milestone stays unlocked regardless of elapsed time / absence.
    const ids1 = first.data.region.milestones.map((m: any) => m.id);
    expect(ids1).toContain(fourTownsMilestoneId);

    // Read again — identical (no decay tick, no streak reset between reads).
    const second = await client.rpc("get_my_passport");
    expect(second.error).toBeNull();
    expect(second.data).toEqual(first.data);
  });
});
