// ===========================================================================
// record-check-in.test.ts — T026 [US2] contract tests for record_check_in.
//
// Validates the success shape (contract §2.1) and every documented error code
// (§2.1 + §7), plus the two atomicity-sensitive behaviors: threshold-crossing
// in one transaction, and the steered first-visit flag.
//
// Arrangement uses anonPatronClient (the real RPC under an anon-patron JWT —
// the sacred path) and serviceClient (bypasses RLS to seed prior history /
// flip business or code state). Each anon session is a fresh patron, so the
// daily-unique key is clean per test unless we deliberately arrange otherwise.
//
// Requires the local stack with migrations + seed applied:
//   supabase db reset
//   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
//   npx vitest run tests/contract/record-check-in.test.ts
// ===========================================================================
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import { SEED, serviceClient, anonPatronClient } from "../integration/helpers";

let svc: SupabaseClient;
let seasonId: string;
let codeAId: string;
let serverToday: string; // region-local "today" per the DB clock

/** A date string `n` days before the server's region-local today. */
function daysAgo(n: number): string {
  const d = new Date(`${serverToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Resolve the patron row id for an anon session's auth uid. */
async function patronIdFor(userId: string): Promise<string> {
  const { data, error } = await svc
    .from("patrons")
    .select("id")
    .eq("auth_user_id", userId)
    .single();
  if (error || !data) throw new Error(`no patron for ${userId}: ${error?.message}`);
  return data.id as string;
}

/**
 * Create the patron row for an anon uid up front (service role), so a test can
 * arrange prior stamps before the first record_check_in call. record_check_in
 * itself resolves-or-creates the patron; this just makes the row exist earlier.
 */
async function ensurePatron(userId: string): Promise<string> {
  const existing = await svc.from("patrons").select("id").eq("auth_user_id", userId).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;
  const { data, error } = await svc
    .from("patrons")
    .insert({ auth_user_id: userId })
    .select("id")
    .single();
  if (error || !data) throw new Error(`ensurePatron failed: ${error?.message}`);
  return data.id as string;
}

beforeAll(async () => {
  svc = serviceClient();
  {
    const { data, error } = await svc
      .from("seasons")
      .select("id")
      .eq("is_current", true)
      .single();
    if (error || !data) throw new Error(`no current season: ${error?.message}`);
    seasonId = data.id as string;
  }
  {
    const { data, error } = await svc
      .from("check_in_codes")
      .select("id")
      .eq("business_id", SEED.businessId)
      .eq("status", "current")
      .single();
    if (error || !data) throw new Error(`no current code: ${error?.message}`);
    codeAId = data.id as string;
  }
  {
    const { data } = await svc.rpc("current_local_date");
    serverToday = data as string;
  }
});

describe("record_check_in (contract §2.1)", () => {
  it("(1) happy first check-in returns the full §2.1 shape", async () => {
    const { client } = await anonPatronClient();
    const { data, error } = await client.rpc("record_check_in", {
      p_business_slug: SEED.businessSlug,
      p_code_value: SEED.codeValue,
      p_device_ref: "dev-happy-1",
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    // stamp
    expect(data.stamp).toBeTruthy();
    expect(typeof data.stamp.id).toBe("string");
    expect(data.stamp.business_slug).toBe(SEED.businessSlug);
    expect(typeof data.stamp.code_version).toBe("number");
    expect(typeof data.stamp.stamped_at).toBe("string");
    expect(data.stamp.attribution).toBe("code_scan");

    // perk_progress (seed perk threshold = 5)
    expect(typeof data.perk_progress.perk_id).toBe("string");
    expect(data.perk_progress.name).toBe("The Regular's Pour");
    expect(data.perk_progress.current).toBe(1);
    expect(data.perk_progress.threshold).toBe(5);
    expect(data.perk_progress.ready).toBe(false);

    // regional_progress
    expect(data.regional_progress.towns_visited).toBe(1);
    expect(data.regional_progress.towns_total).toBe(12);
    expect(Array.isArray(data.regional_progress.milestones_unlocked)).toBe(true);
    expect(data.regional_progress.milestones_unlocked).toHaveLength(0);

    // first_visit_flags
    expect(data.first_visit_flags.first_at_business).toBe(true);
    expect(data.first_visit_flags.first_in_town).toBe(true);
    expect(data.first_visit_flags.steered).toBe(false);
  });

  it("(2) same patron, same day, again → DAILY_LIMIT and exactly one stamp", async () => {
    const { client, userId } = await anonPatronClient();
    const first = await client.rpc("record_check_in", {
      p_business_slug: SEED.businessSlug,
      p_code_value: SEED.codeValue,
      p_device_ref: "dev-daily-1",
    });
    expect(first.error).toBeNull();

    const second = await client.rpc("record_check_in", {
      p_business_slug: SEED.businessSlug,
      p_code_value: SEED.codeValue,
      p_device_ref: "dev-daily-1",
    });
    expect(second.error).not.toBeNull();
    expect(second.error!.message).toContain("DAILY_LIMIT");

    const patronId = await patronIdFor(userId);
    const { data: stamps } = await svc
      .from("stamps")
      .select("id")
      .eq("patron_id", patronId)
      .eq("business_id", SEED.businessId);
    expect(stamps ?? []).toHaveLength(1);
  });

  it("(3) unknown code value → CODE_INVALID", async () => {
    const { client } = await anonPatronClient();
    const { error } = await client.rpc("record_check_in", {
      p_business_slug: SEED.businessSlug,
      p_code_value: "no-such-code-value",
      p_device_ref: "dev-invalid-1",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("CODE_INVALID");
  });

  it("(4) retired code → CODE_RETIRED, reprint flag set, no stamp, gates unchanged", async () => {
    // Snapshot the gate union before.
    const before = await svc.from("gate_metrics_all").select("metric, value, n");
    const beforeRows = before.data ?? [];

    // Arrange a retired code on The Heron via service role.
    const retiredValue = `retired-heron-${Date.now()}`;
    const { data: nextVer } = await svc
      .from("check_in_codes")
      .select("version")
      .eq("business_id", SEED.businessId)
      .order("version", { ascending: false })
      .limit(1)
      .single();
    const ins = await svc
      .from("check_in_codes")
      .insert({
        business_id: SEED.businessId,
        value: retiredValue,
        version: (nextVer?.version ?? 1) + 100,
        status: "retired",
        grace_until: new Date(Date.now() - 3600_000).toISOString(),
      })
      .select("id")
      .single();
    expect(ins.error).toBeNull();

    // Clear any prior reprint flag so we observe a fresh set.
    await svc.from("reprint_flags").delete().eq("business_id", SEED.businessId);

    const { client, userId } = await anonPatronClient();
    const { error } = await client.rpc("record_check_in", {
      p_business_slug: SEED.businessSlug,
      p_code_value: retiredValue,
      p_device_ref: "dev-retired-1",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("CODE_RETIRED");

    // reprint flag created for the business.
    const flag = await svc
      .from("reprint_flags")
      .select("business_id, cleared_at")
      .eq("business_id", SEED.businessId)
      .maybeSingle();
    expect(flag.data).toBeTruthy();
    expect(flag.data!.cleared_at).toBeNull();

    // No stamp for this patron. The retired path raises before the patron is
    // even created, so there may be no patron row at all — either way, no stamp.
    const pr = await svc.from("patrons").select("id").eq("auth_user_id", userId).maybeSingle();
    if (pr.data?.id) {
      const stamps = await svc.from("stamps").select("id").eq("patron_id", pr.data.id);
      expect(stamps.data ?? []).toHaveLength(0);
    }

    // A valid stamp inserted elsewhere remains, and the gate union is unchanged
    // by the retired scan (the retired scan contributed nothing).
    const after = await svc.from("gate_metrics_all").select("metric, value, n");
    const afterRows = after.data ?? [];
    expect(afterRows).toEqual(beforeRows);

    // cleanup the retired row
    await svc.from("check_in_codes").delete().eq("id", ins.data!.id);
  });

  it("(5) suspended business → BUSINESS_SUSPENDED (status restored after)", async () => {
    await svc.from("businesses").update({ status: "suspended" }).eq("id", SEED.businessId);
    try {
      const { client } = await anonPatronClient();
      const { error } = await client.rpc("record_check_in", {
        p_business_slug: SEED.businessSlug,
        p_code_value: SEED.codeValue,
        p_device_ref: "dev-suspended-1",
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain("BUSINESS_SUSPENDED");
    } finally {
      await svc.from("businesses").update({ status: "active" }).eq("id", SEED.businessId);
    }
  });

  it("(6) atomic threshold-crossing: 5th check-in returns perk ready", async () => {
    const { client, userId } = await anonPatronClient();
    const patronId = await ensurePatron(userId);

    // Arrange 4 prior valid stamps on distinct past local_dates (code attribution).
    const rows = [1, 2, 3, 4].map((d) => ({
      patron_id: patronId,
      business_id: SEED.businessId,
      season_id: seasonId,
      local_date: daysAgo(d),
      code_version_ref: codeAId,
      trust_valid: true,
    }));
    const arrange = await svc.from("stamps").insert(rows);
    expect(arrange.error).toBeNull();

    const { data, error } = await client.rpc("record_check_in", {
      p_business_slug: SEED.businessSlug,
      p_code_value: SEED.codeValue,
      p_device_ref: "dev-threshold-1",
    });
    expect(error).toBeNull();
    expect(data.perk_progress.current).toBe(5);
    expect(data.perk_progress.threshold).toBe(5);
    expect(data.perk_progress.ready).toBe(true);
  });

  it("(7) steered flag true when a prior impression exists", async () => {
    const { client, userId } = await anonPatronClient();
    const patronId = await ensurePatron(userId);

    // Impression dated yesterday (server clock) → steered first visit today.
    const imp = await svc.from("steer_impressions").insert({
      patron_id: patronId,
      business_id: SEED.businessId,
      surface: "discovery_list",
      local_date: daysAgo(1),
    });
    expect(imp.error).toBeNull();

    const { data, error } = await client.rpc("record_check_in", {
      p_business_slug: SEED.businessSlug,
      p_code_value: SEED.codeValue,
      p_device_ref: "dev-steered-1",
    });
    expect(error).toBeNull();
    expect(data.first_visit_flags.steered).toBe(true);
  });
});

afterAll(async () => {
  // The retired-code test cleans its own row; nothing else persistent to undo
  // (each anon patron is ephemeral fixture data within the test DB).
});
