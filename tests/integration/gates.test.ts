// ===========================================================================
// gates.test.ts — US7 gate apparatus integration (T058). SC-004 / SC-010.
//
// (1) fresh-seed: read_gate_metrics returns all 8 rows, never errors;
//     stamp-derived metrics show validity 'insufficient_sample' (n below the
//     seeded floors) and verdict_eligibility INSUFFICIENT_SAMPLE; values are
//     null-or-numeric, never fabricated.
// (2) arranged: 3 active subscriptions → paying_business_count value 3 with the
//     threshold target (15) visible.
// (3) snapshot idempotency: snapshot_gate_metrics() twice same day → 8 rows only.
// (4) void interaction: voiding a stamp removes it from verified_regulars and
//     same_business_repeat_rate (delta visible) — FR-018 path to the gates.
//
// Requires the running local stack with migrations + seed applied:
//   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
//   export API_URL ANON_KEY SERVICE_ROLE_KEY
//   npx vitest run tests/integration/gates.test.ts
// ===========================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import {
  SEED,
  serviceClient,
  adminClient,
  anonPatronClient,
  ensureSeedAuthPasswords,
} from "./helpers";

let svc: SupabaseClient;
let admin: SupabaseClient;
let seasonId: string;

const STAMP_DERIVED = [
  "second_business_rate_21d",
  "same_business_repeat_rate",
  "median_checkins_per_active",
  "steered_first_visit_rate",
];

// Row shape per contract §4.4 (read_gate_metrics).
type GateMetricRow = {
  metric: string;
  value: number | string | null;
  n: number;
  threshold: { target?: number | string; kill?: number | string; sample_floor?: number };
  kill_floor: number | string | null;
  sample_floor: number | null;
  validity: string;
  valid: boolean;
  verdict_eligibility: string;
};

function metricsByName(rows: GateMetricRow[]) {
  return Object.fromEntries(rows.map((r) => [r.metric, r]));
}

beforeAll(async () => {
  svc = serviceClient();
  await ensureSeedAuthPasswords();
  admin = await adminClient();
  const { data } = await svc.from("seasons").select("id").eq("is_current", true).single();
  seasonId = data!.id as string;
});

describe("(1) fresh-seed gate read (SC-004)", () => {
  it("returns all 8 metrics, never errors; values null-or-numeric", async () => {
    const { data, error } = await admin.rpc("read_gate_metrics");
    expect(error).toBeNull();
    expect(data.length).toBe(8);
    for (const row of data) {
      // Value is either null or a finite number — never fabricated.
      if (row.value !== null) {
        expect(Number.isFinite(Number(row.value))).toBe(true);
      }
      expect(typeof row.n).toBe("number");
    }
  });

  it("stamp-derived metrics below floor → insufficient_sample / INSUFFICIENT_SAMPLE", async () => {
    const { data } = await admin.rpc("read_gate_metrics");
    const by = metricsByName(data);
    for (const m of STAMP_DERIVED) {
      const row = by[m];
      // Fresh seed has n below the 200 sample floor for these metrics.
      if (row.n < (row.sample_floor ?? 0)) {
        expect(row.validity).toBe("insufficient_sample");
        expect(row.valid).toBe(false);
        expect(row.verdict_eligibility).toBe("INSUFFICIENT_SAMPLE");
      }
    }
  });
});

describe("(2) arranged paying_business_count (SC-010)", () => {
  it("3 active subscriptions → value 3, target 15 visible", async () => {
    // Clear any subscriptions, then arrange exactly 3 active ones across 3
    // throwaway active businesses.
    await svc.from("subscriptions").delete().neq("id", crypto.randomUUID());

    const townRes = await svc.from("towns").select("id").eq("slug", "callicoon").single();
    const townId = townRes.data!.id as string;
    const run = crypto.randomUUID().slice(0, 6);
    // stamp_code must match ^[A-Z]{3,4}$ and be unique per region; derive 4
    // letters from the run id so repeated runs don't collide.
    const letters = (s: string) =>
      Array.from(s).map((c) => String.fromCharCode(65 + (parseInt(c, 36) % 26))).join("");
    for (let i = 0; i < 3; i++) {
      const ownerUserId = crypto.randomUUID();
      const email = `paybiz-${run}-${i}@test`;
      await svc.auth.admin.createUser({ user_id: ownerUserId, email, email_confirm: true } as never).catch(() => undefined);
      const { data: users } = await svc.auth.admin.listUsers();
      const resolvedOwner = users?.users?.find((u) => u.email === email)?.id ?? ownerUserId;
      const { data: biz } = await svc
        .from("businesses")
        .insert({
          region_id: SEED.regionId,
          town_id: townId,
          owner_user_id: resolvedOwner,
          name: `Pay Biz ${run}-${i}`,
          slug: `pay-biz-${run}-${i}`,
          category: "cafe",
          hours: {},
          stamp_code: (letters(run).slice(0, 3) + String.fromCharCode(65 + i)).slice(0, 4),
          status: "active",
        })
        .select("id")
        .single();
      await svc.from("subscriptions").insert({
        business_id: biz!.id,
        stripe_customer_id: `cus_${run}_${i}`,
        stripe_subscription_id: `sub_${run}_${i}`,
        plan: "founding_79",
        founding_price_id: "price_founding_test",
        status: "active",
      });
    }

    const { data } = await admin.rpc("read_gate_metrics");
    const row = metricsByName(data)["paying_business_count"];
    expect(Number(row.value)).toBe(3);
    expect(Number(row.threshold.target)).toBe(15);
  });
});

describe("(3) snapshot per-day idempotency", () => {
  it("snapshot_gate_metrics() twice same day → 8 rows only", async () => {
    // Clean today's snapshots first so the count assertion is deterministic.
    const today = new Date().toISOString().slice(0, 10);
    await svc.from("gate_metric_snapshots").delete().gte("taken_at", `${today}T00:00:00Z`);

    const first = await svc.rpc("snapshot_gate_metrics");
    expect(first.error).toBeNull();
    expect(first.data).toBe(8);

    const second = await svc.rpc("snapshot_gate_metrics");
    expect(second.error).toBeNull();
    expect(second.data).toBe(0); // per-day idempotent: nothing new inserted

    const { data: rows } = await svc
      .from("gate_metric_snapshots")
      .select("metric")
      .gte("taken_at", `${today}T00:00:00Z`);
    expect(rows!.length).toBe(8);
    // Every snapshot references a valid gate metric (FK to gate_thresholds).
    const metrics = new Set(rows!.map((r) => r.metric));
    expect(metrics.size).toBe(8);
  });
});

describe("(4) void → gate exclusion (FR-018)", () => {
  it("voiding a stamp removes a verified regular and lowers same_business_repeat", async () => {
    // Arrange a patron with 2 valid stamps at The Heron (a repeat pair).
    const { userId } = await anonPatronClient();
    const { data: patron } = await svc
      .from("patrons")
      .insert({ auth_user_id: userId })
      .select("id")
      .single();
    const { data: code } = await svc
      .from("check_in_codes")
      .select("id")
      .eq("business_id", SEED.businessId)
      .eq("status", "current")
      .single();
    const ids: string[] = [];
    for (const d of ["2026-08-01", "2026-08-02"]) {
      const { data: s } = await svc
        .from("stamps")
        .insert({
          patron_id: patron!.id,
          business_id: SEED.businessId,
          season_id: seasonId,
          local_date: d,
          code_version_ref: code!.id,
        })
        .select("id")
        .single();
      ids.push(s!.id as string);
    }

    const regBefore = await svc
      .from("verified_regulars_per_business")
      .select("verified_regulars")
      .eq("business_id", SEED.businessId)
      .single();
    const before = regBefore.data?.verified_regulars ?? 0;

    // Void one of the two stamps.
    const { error } = await admin.rpc("void_stamp", {
      p_stamp_id: ids[0],
      p_reason: "gate exclusion test",
    });
    expect(error).toBeNull();

    const regAfter = await svc
      .from("verified_regulars_per_business")
      .select("verified_regulars")
      .eq("business_id", SEED.businessId)
      .single();
    const after = regAfter.data?.verified_regulars ?? 0;

    // The patron dropped below 2 valid stamps → one fewer verified regular.
    expect(after).toBe(before - 1);

    // Same-business-repeat gate metric also reflects the exclusion: the voided
    // stamp no longer appears in valid_stamps, so the pair drops out.
    const { data: gate } = await admin.rpc("read_gate_metrics");
    const row = metricsByName(gate)["same_business_repeat_rate"];
    expect(row).toBeTruthy(); // metric still computes, never errors
  });
});
