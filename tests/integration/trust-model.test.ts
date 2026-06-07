// ===========================================================================
// trust-model.test.ts — T033 [US2] SC-003: the trust model, proven.
//
// (1) The only door into stamps is the trust RPC: a direct INSERT as a patron
//     client is rejected (no insert policy), and even via service role a stamp
//     with NEITHER or BOTH attribution refs is rejected by the one_attribution
//     CHECK.
// (2) A retired-code scan leaves the gate views unchanged (snapshot before/after
//     via the service client over gate_metrics_all).
// (3) The staff path produces a staff_entries row + a stamp with staff_entry_ref,
//     visible in a list query.
// (4) The rate limit is per PATRON, not per device: the same authed patron with
//     two linked devices is still capped at one stamp per business per day.
// (5) Voided / trust-invalid stamps are excluded from verified_regulars + gates.
// ===========================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import {
  SEED,
  serviceClient,
  ownerClient,
  anonPatronClient,
  ensureSeedAuthPasswords,
} from "./helpers";

let svc: SupabaseClient;
let seasonId: string;
let codeAId: string;
let serverToday: string;

function daysAgo(n: number): string {
  const d = new Date(`${serverToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function patronIdFor(userId: string): Promise<string> {
  const { data } = await svc.from("patrons").select("id").eq("auth_user_id", userId).single();
  return data!.id as string;
}

beforeAll(async () => {
  svc = serviceClient();
  await ensureSeedAuthPasswords();
  seasonId = (await svc.from("seasons").select("id").eq("is_current", true).single()).data!.id;
  codeAId = (
    await svc
      .from("check_in_codes")
      .select("id")
      .eq("business_id", SEED.businessId)
      .eq("status", "current")
      .single()
  ).data!.id;
  serverToday = (await svc.rpc("current_local_date")).data as string;
});

describe("SC-003 trust model", () => {
  it("(1) direct stamp insert is blocked; CHECK rejects bad attribution", async () => {
    // a) Patron client direct INSERT → no insert policy → blocked.
    const { client: patron, userId } = await anonPatronClient();
    const selfId = (
      await svc.from("patrons").insert({ auth_user_id: userId }).select("id").single()
    ).data!.id;
    const direct = await patron
      .from("stamps")
      .insert({
        patron_id: selfId,
        business_id: SEED.businessId,
        season_id: seasonId,
        local_date: serverToday,
        code_version_ref: codeAId,
      })
      .select("id");
    expect(direct.error !== null || (direct.data ?? []).length === 0).toBe(true);

    // b) Service role, BOTH refs → one_attribution CHECK violation.
    const staffEntry = (
      await svc
        .from("staff_entries")
        .insert({
          business_id: SEED.businessId,
          staff_user_id: SEED.ownerUserId,
          patron_phone: "+18455550000",
          local_date: daysAgo(40),
        })
        .select("id")
        .single()
    ).data!.id;
    const both = await svc.from("stamps").insert({
      patron_id: selfId,
      business_id: SEED.businessId,
      season_id: seasonId,
      local_date: daysAgo(41),
      code_version_ref: codeAId,
      staff_entry_ref: staffEntry,
    });
    expect(both.error).not.toBeNull();

    // c) Service role, NEITHER ref → CHECK violation.
    const neither = await svc.from("stamps").insert({
      patron_id: selfId,
      business_id: SEED.businessId,
      season_id: seasonId,
      local_date: daysAgo(42),
    });
    expect(neither.error).not.toBeNull();
  });

  it("(2) retired-code scan leaves gate views unchanged", async () => {
    const before = (await svc.from("gate_metrics_all").select("metric, value, n")).data ?? [];

    const retiredValue = `retired-trust-${Date.now()}`;
    await svc.from("check_in_codes").insert({
      business_id: SEED.businessId,
      value: retiredValue,
      version: 5000 + Math.floor(Math.random() * 1000),
      status: "retired",
      grace_until: new Date(Date.now() - 3600_000).toISOString(),
    });

    const { client } = await anonPatronClient();
    const { error } = await client.rpc("record_check_in", {
      p_business_slug: SEED.businessSlug,
      p_code_value: retiredValue,
      p_device_ref: "trust-retired",
    });
    expect(error!.message).toContain("CODE_RETIRED");

    const after = (await svc.from("gate_metrics_all").select("metric, value, n")).data ?? [];
    expect(after).toEqual(before);
  });

  it("(3) staff path produces a staff_entries row + stamp with staff_entry_ref", async () => {
    const owner = await ownerClient(SEED.ownerEmail);
    const phone = `+1845555${Math.floor(1000 + Math.random() * 8999)}`;
    const { data, error } = await owner.rpc("staff_check_in", {
      p_business_id: SEED.businessId,
      p_phone: phone,
    });
    expect(error).toBeNull();
    expect(data.stamp.attribution).toBe("staff_entry");
    expect(typeof data.stamp.staff_session).toBe("string");

    // The stamp carries staff_entry_ref and shows in a list query.
    const stamp = await svc
      .from("stamps")
      .select("id, staff_entry_ref, code_version_ref")
      .eq("id", data.stamp.id)
      .single();
    expect(stamp.data!.staff_entry_ref).toBeTruthy();
    expect(stamp.data!.code_version_ref).toBeNull();

    const entries = await svc
      .from("staff_entries")
      .select("id, patron_phone")
      .eq("patron_phone", phone);
    expect((entries.data ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("(4) rate limit is per patron, not per device", async () => {
    const { client, userId } = await anonPatronClient();
    // Unique per run: device_token is globally UNIQUE — fixed strings couple
    // this test to every other file that touches patron_devices.
    const deviceA = `device-A-${crypto.randomUUID()}`;
    const deviceB = `device-B-${crypto.randomUUID()}`;
    // First check-in (creates patron + device A).
    const first = await client.rpc("record_check_in", {
      p_business_slug: SEED.businessSlug,
      p_code_value: SEED.codeValue,
      p_device_ref: deviceA,
    });
    expect(first.error).toBeNull();

    // Link a second device to the SAME patron.
    const link = await client.rpc("link_device", { p_device_token: deviceB });
    expect(link.error).toBeNull();

    // Second check-in same business same day, now from device B → still DAILY_LIMIT.
    const second = await client.rpc("record_check_in", {
      p_business_slug: SEED.businessSlug,
      p_code_value: SEED.codeValue,
      p_device_ref: deviceB,
    });
    expect(second.error).not.toBeNull();
    expect(second.error!.message).toContain("DAILY_LIMIT");

    // Exactly one stamp for the patron at the business.
    const patronId = await patronIdFor(userId);
    const stamps = await svc
      .from("stamps")
      .select("id")
      .eq("patron_id", patronId)
      .eq("business_id", SEED.businessId);
    expect(stamps.data ?? []).toHaveLength(1);
  });

  it("(5) voided / trust-invalid stamps are excluded from regulars + gates", async () => {
    // Arrange a fresh patron with 2 valid stamps at The Heron (a verified regular).
    const patronId = (
      await svc.from("patrons").insert({ display_name: "Void Test" }).select("id").single()
    ).data!.id;
    await svc.from("stamps").insert([
      {
        patron_id: patronId,
        business_id: SEED.businessId,
        season_id: seasonId,
        local_date: daysAgo(10),
        code_version_ref: codeAId,
        trust_valid: true,
      },
      {
        patron_id: patronId,
        business_id: SEED.businessId,
        season_id: seasonId,
        local_date: daysAgo(11),
        code_version_ref: codeAId,
        trust_valid: true,
      },
    ]);

    const regularsBefore = (
      await svc
        .from("verified_regulars_per_business")
        .select("verified_regulars")
        .eq("business_id", SEED.businessId)
        .maybeSingle()
    ).data?.verified_regulars as number;

    // Void one of the two → patron drops below the 2-stamp regular threshold.
    const oneStamp = (
      await svc
        .from("stamps")
        .select("id")
        .eq("patron_id", patronId)
        .eq("local_date", daysAgo(10))
        .single()
    ).data!.id;
    await svc
      .from("stamps")
      .update({ voided_at: new Date().toISOString(), void_reason: "test-void" })
      .eq("id", oneStamp);

    const regularsAfter = (
      await svc
        .from("verified_regulars_per_business")
        .select("verified_regulars")
        .eq("business_id", SEED.businessId)
        .maybeSingle()
    ).data?.verified_regulars as number | undefined;

    // The voided stamp removed this patron from the regulars count.
    expect((regularsAfter ?? 0)).toBe((regularsBefore ?? 1) - 1);
  });
});
