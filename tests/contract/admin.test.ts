// ===========================================================================
// admin.test.ts — US7 admin contract tests (T054).
//
// Exercises the admin RPCs against contracts/api.md §4:
//   approve_business / decline_business (+ list_pending_businesses duplicate
//   hints), curate_founding_pick, rotate_code, read_gate_metrics, void_stamp,
//   list_staff_entry_audit.
//
// RPC custom errors surface through PostgREST as { code: "P0001",
// message: "<ERROR_CODE>" } (a RAISE EXCEPTION carries the §7 machine code in
// `message`), so error assertions branch on `error.message` — never on prose.
//
// All admin verbs are admin-only; every block also asserts FORBIDDEN for a
// non-admin (ownerClient).
//
// Requires the running local stack with migrations + seed applied:
//   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
//   export API_URL ANON_KEY SERVICE_ROLE_KEY
//   npx vitest run tests/contract/admin.test.ts
// ===========================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import {
  SEED,
  serviceClient,
  adminClient,
  ownerClient,
  anonPatronClient,
  ensureSeedAuthPasswords,
} from "../integration/helpers";

let svc: SupabaseClient;
let admin: SupabaseClient;
let owner: SupabaseClient;
let seasonId: string;
let narrowsburgTownId: string;

const RUN = crypto.randomUUID().slice(0, 8);

// Unique 4-letter stamp code per call (region-unique constraint). Derived from
// the run id + a monotonic counter so repeated test-process runs never collide.
let codeSeq = 0;
function nextStampCode(): string {
  const base = Array.from(RUN.slice(0, 2))
    .map((c) => String.fromCharCode(65 + (parseInt(c, 36) % 26)))
    .join("");
  const n = codeSeq++;
  const a = String.fromCharCode(65 + Math.floor(n / 26) % 26);
  const b = String.fromCharCode(65 + (n % 26));
  return (base + a + b).slice(0, 4);
}

// Arrange a fresh pending business in a given town and return its id.
async function makePendingBusiness(
  name: string,
  slug: string,
  townSlug: string,
  stampCode: string = nextStampCode(),
): Promise<string> {
  const { data: town } = await svc.from("towns").select("id").eq("slug", townSlug).single();
  // A throwaway owner user — pending businesses still need an owner FK.
  const ownerUserId = crypto.randomUUID();
  await svc.auth.admin
    .createUser({
      user_id: ownerUserId,
      email: `pend-${slug}-${RUN}@test`,
      email_confirm: true,
    } as never)
    .catch(() => undefined);
  let resolvedOwner = ownerUserId;
  {
    const { data } = await svc.auth.admin.listUsers();
    const u = data?.users?.find((x) => x.email === `pend-${slug}-${RUN}@test`);
    if (u) resolvedOwner = u.id;
  }
  const { data: biz, error } = await svc
    .from("businesses")
    .insert({
      region_id: SEED.regionId,
      town_id: town!.id,
      owner_user_id: resolvedOwner,
      name,
      slug,
      category: "cafe",
      hours: {},
      stamp_code: stampCode,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(`makePendingBusiness(${slug}): ${error.message}`);
  return biz!.id as string;
}

beforeAll(async () => {
  svc = serviceClient();
  await ensureSeedAuthPasswords();
  admin = await adminClient();
  owner = await ownerClient(); // mira — a non-admin

  {
    const { data } = await svc.from("seasons").select("id").eq("is_current", true).single();
    seasonId = data!.id as string;
  }
  {
    const { data } = await svc.from("towns").select("id").eq("slug", "narrowsburg").single();
    narrowsburgTownId = data!.id as string;
  }
});

describe("approve_business (§4.1)", () => {
  it("pending → active, records approved_by; re-approve → INVALID_STATE", async () => {
    const id = await makePendingBusiness(`Approve Me ${RUN}`, `approve-me-${RUN}`, "callicoon");
    const { data, error } = await admin.rpc("approve_business", { p_business_id: id });
    expect(error).toBeNull();
    expect(data.status).toBe("active");
    expect(data.business_id).toBe(id);
    expect(data.approved_by).toBeTruthy();
    expect(data.approved_at).toBeTruthy();

    // Re-approve an already-active business → INVALID_STATE.
    const again = await admin.rpc("approve_business", { p_business_id: id });
    expect(again.error).not.toBeNull();
    expect(again.error!.message).toBe("INVALID_STATE");
  });

  it("FORBIDDEN for a non-admin", async () => {
    const id = await makePendingBusiness(`Owner Approve ${RUN}`, `owner-approve-${RUN}`, "eldred");
    const { error } = await owner.rpc("approve_business", { p_business_id: id });
    expect(error).not.toBeNull();
    expect(error!.message).toBe("FORBIDDEN");
    // Unchanged.
    const { data } = await svc.from("businesses").select("status").eq("id", id).single();
    expect(data!.status).toBe("pending");
  });
});

describe("decline_business (§4.1)", () => {
  it("records reason, returns subscription_cancelled, business → declined", async () => {
    const id = await makePendingBusiness(`Decline Me ${RUN}`, `decline-me-${RUN}`, "bethel");
    const { data, error } = await admin.rpc("decline_business", {
      p_business_id: id,
      p_reason: "duplicate of an existing listing",
    });
    expect(error).toBeNull();
    expect(data.status).toBe("declined");
    expect(data.business_id).toBe(id);
    // subscription_cancelled is a truthy boolean per contract (deviation:
    // 'pending_stripe' because the webhook is the single writer — see report).
    expect(data.subscription_cancelled).toBeTruthy();

    const { data: row } = await svc.from("businesses").select("status").eq("id", id).single();
    expect(row!.status).toBe("declined");

    // The decline action + reason is recorded in the admin_actions audit.
    const { data: act } = await svc
      .from("admin_actions")
      .select("action, reason")
      .eq("target_business_id", id)
      .eq("action", "decline_business")
      .single();
    expect(act!.reason).toBe("duplicate of an existing listing");
  });

  it("FORBIDDEN for a non-admin", async () => {
    const id = await makePendingBusiness(`Owner Decline ${RUN}`, `owner-decline-${RUN}`, "hawley");
    const { error } = await owner.rpc("decline_business", { p_business_id: id, p_reason: "x" });
    expect(error).not.toBeNull();
    expect(error!.message).toBe("FORBIDDEN");
  });
});

describe("list_pending_businesses (§4.1 — duplicate hints)", () => {
  it("two same-name+town pendings surface duplicate_hints match_on name+town", async () => {
    const name = `Twins ${RUN}`;
    await makePendingBusiness(name, `twins-a-${RUN}`, "milford");
    await makePendingBusiness(name, `twins-b-${RUN}`, "milford");

    const { data, error } = await admin.rpc("list_pending_businesses");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    const rows = data.filter((r: { name: string }) => r.name === name);
    expect(rows.length).toBe(2);
    for (const r of rows) {
      expect(Array.isArray(r.duplicate_hints)).toBe(true);
      const hint = r.duplicate_hints.find(
        (h: { match_on: string }) => h.match_on === "name+town",
      );
      expect(hint).toBeTruthy();
      expect(hint.business_id).toBeTruthy();
    }
  });

  it("FORBIDDEN for a non-admin", async () => {
    const { error } = await owner.rpc("list_pending_businesses");
    expect(error).not.toBeNull();
    expect(error!.message).toBe("FORBIDDEN");
  });
});

describe("curate_founding_pick (§4.2)", () => {
  it("set then order then unset; position unique per town", async () => {
    // The Heron is active in Narrowsburg.
    const set = await admin.rpc("curate_founding_pick", {
      p_business_id: SEED.businessId,
      p_town: "narrowsburg",
      p_action: "set",
    });
    expect(set.error).toBeNull();
    expect(set.data.town).toBe("narrowsburg");
    expect(set.data.picks.some((p: { business_id: string }) => p.business_id === SEED.businessId)).toBe(true);

    const order = await admin.rpc("curate_founding_pick", {
      p_business_id: SEED.businessId,
      p_town: "narrowsburg",
      p_action: "order",
      p_position: 1,
    });
    expect(order.error).toBeNull();
    const mine = order.data.picks.find((p: { business_id: string }) => p.business_id === SEED.businessId);
    expect(mine.position).toBe(1);
    expect(mine.curated_by).toBeTruthy();

    const unset = await admin.rpc("curate_founding_pick", {
      p_business_id: SEED.businessId,
      p_town: "narrowsburg",
      p_action: "unset",
    });
    expect(unset.error).toBeNull();
    expect(unset.data.picks.some((p: { business_id: string }) => p.business_id === SEED.businessId)).toBe(false);
  });

  it("VALIDATION on a bad action", async () => {
    const { error } = await admin.rpc("curate_founding_pick", {
      p_business_id: SEED.businessId,
      p_town: "narrowsburg",
      p_action: "bogus",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toBe("VALIDATION");
  });

  it("FORBIDDEN for a non-admin", async () => {
    const { error } = await owner.rpc("curate_founding_pick", {
      p_business_id: SEED.businessId,
      p_town: "narrowsburg",
      p_action: "set",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toBe("FORBIDDEN");
  });
});

describe("rotate_code (§4.3)", () => {
  it("new_version increments, prior → grace with grace_until, reprint_prompted", async () => {
    const before = await svc
      .from("check_in_codes")
      .select("version")
      .eq("business_id", SEED.businessId)
      .eq("status", "current")
      .single();
    const beforeVersion = before.data!.version as number;

    const { data, error } = await admin.rpc("rotate_code", {
      p_business_id: SEED.businessId,
      p_reason: "scheduled manual rotation",
    });
    expect(error).toBeNull();
    expect(data.new_version).toBe(beforeVersion + 1);
    expect(data.grace_until).toBeTruthy();
    expect(data.reprint_prompted).toBe(true);

    // The prior code is now in grace.
    const { data: grace } = await svc
      .from("check_in_codes")
      .select("status")
      .eq("business_id", SEED.businessId)
      .eq("version", beforeVersion)
      .single();
    expect(grace!.status).toBe("grace");

    // Manual rotation reason recorded in rotation_audit.
    const { data: aud } = await svc
      .from("rotation_audit")
      .select("reason")
      .eq("business_id", SEED.businessId)
      .order("rotated_at", { ascending: false })
      .limit(1)
      .single();
    expect(aud!.reason).toBe("scheduled manual rotation");
  });

  it("schedule update {interval_days, grace_hours} persists", async () => {
    const { data, error } = await admin.rpc("rotate_code", {
      p_business_id: SEED.businessId,
      p_reason: "schedule edit",
      p_schedule: { interval_days: 14, grace_hours: 48 },
    });
    expect(error).toBeNull();
    expect(data.schedule.interval_days).toBe(14);
    expect(data.schedule.grace_hours).toBe(48);

    const { data: sched } = await svc
      .from("rotation_schedules")
      .select("interval_days, grace_hours")
      .eq("business_id", SEED.businessId)
      .single();
    expect(sched!.interval_days).toBe(14);
    expect(sched!.grace_hours).toBe(48);
  });

  it("FORBIDDEN for a non-admin", async () => {
    const { error } = await owner.rpc("rotate_code", {
      p_business_id: SEED.businessId,
      p_reason: "x",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toBe("FORBIDDEN");
  });
});

describe("read_gate_metrics (§4.4)", () => {
  const EXPECTED = [
    "second_business_rate_21d",
    "same_business_repeat_rate",
    "median_checkins_per_active",
    "steered_first_visit_rate",
    "passport_adds",
    "patron_signups_per_business",
    "paying_business_count",
    "billing_retention_rate",
  ];

  it("returns all 8 metrics with the full per-metric shape", async () => {
    const { data, error } = await admin.rpc("read_gate_metrics");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    const metrics = data.map((r: { metric: string }) => r.metric).sort();
    expect(metrics).toEqual([...EXPECTED].sort());

    for (const row of data) {
      expect(row).toHaveProperty("metric");
      expect(row).toHaveProperty("value"); // null-or-numeric, never fabricated
      expect(row).toHaveProperty("n");
      expect(row).toHaveProperty("threshold");
      expect(row).toHaveProperty("kill_floor");
      expect(row).toHaveProperty("sample_floor");
      expect(typeof row.valid).toBe("boolean");
      expect(["ELIGIBLE", "INSUFFICIENT_SAMPLE", "TRUST_MODEL_VOID"]).toContain(
        row.verdict_eligibility,
      );
    }
  });

  it("FORBIDDEN for a non-admin", async () => {
    const { error } = await owner.rpc("read_gate_metrics");
    expect(error).not.toBeNull();
    expect(error!.message).toBe("FORBIDDEN");
  });
});

describe("void_stamp (§4.6)", () => {
  it("status flip + reason + voided_by; idempotent; excluded from regulars", async () => {
    // Arrange a patron with 2 stamps at The Heron → a verified regular.
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

    const stampIds: string[] = [];
    for (const d of ["2026-07-10", "2026-07-11"]) {
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
      stampIds.push(s!.id as string);
    }

    // The patron is a verified regular (2 valid stamps) — count before.
    const before = await svc
      .from("verified_regulars_per_business")
      .select("verified_regulars")
      .eq("business_id", SEED.businessId)
      .single();
    const beforeRegulars = before.data?.verified_regulars ?? 0;

    const { data, error } = await admin.rpc("void_stamp", {
      p_stamp_id: stampIds[0],
      p_reason: "test correction",
    });
    expect(error).toBeNull();
    expect(data.status).toBe("void");
    expect(data.voided_by).toBeTruthy();
    expect(data.voided_at).toBeTruthy();
    expect(data.reason).toBe("test correction");

    // Row still exists (history preserved, never deleted).
    const { data: row } = await svc
      .from("stamps")
      .select("voided_at, trust_valid")
      .eq("id", stampIds[0])
      .single();
    expect(row!.voided_at).toBeTruthy();

    // Idempotent: re-voiding is a no-op (no error).
    const again = await admin.rpc("void_stamp", {
      p_stamp_id: stampIds[0],
      p_reason: "second time",
    });
    expect(again.error).toBeNull();
    expect(again.data.status).toBe("void");

    // After voiding one of two stamps, the patron drops below 2 valid → no
    // longer a verified regular for this business.
    const after = await svc
      .from("verified_regulars_per_business")
      .select("verified_regulars")
      .eq("business_id", SEED.businessId)
      .single();
    const afterRegulars = after.data?.verified_regulars ?? 0;
    expect(afterRegulars).toBe(beforeRegulars - 1);
  });

  it("STAMP_NOT_FOUND for a missing stamp", async () => {
    const { error } = await admin.rpc("void_stamp", {
      p_stamp_id: crypto.randomUUID(),
      p_reason: "x",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toBe("STAMP_NOT_FOUND");
  });

  it("FORBIDDEN for a non-admin", async () => {
    const { error } = await owner.rpc("void_stamp", {
      p_stamp_id: crypto.randomUUID(),
      p_reason: "x",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toBe("FORBIDDEN");
  });
});

describe("list_staff_entry_audit (§4.5)", () => {
  it("returns audit rows with the documented shape", async () => {
    // Arrange a staff entry via the owner staff_check_in path.
    const phone = `+1555${Math.floor(1000000 + Math.random() * 8999999)}`;
    const sc = await owner.rpc("staff_check_in", {
      p_business_id: SEED.businessId,
      p_phone: phone,
    });
    expect(sc.error).toBeNull();

    const { data, error } = await admin.rpc("list_staff_entry_audit", {
      p_business_id: SEED.businessId,
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    const row = data[0];
    expect(row).toHaveProperty("stamp_id");
    expect(row).toHaveProperty("business_id");
    expect(row).toHaveProperty("staff_session");
    expect(row).toHaveProperty("patron_ref");
    expect(row).toHaveProperty("at");
    expect(typeof row.flagged_anomaly).toBe("boolean");
  });

  it("FORBIDDEN for a non-admin", async () => {
    const { error } = await owner.rpc("list_staff_entry_audit", {
      p_business_id: SEED.businessId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toBe("FORBIDDEN");
  });
});
