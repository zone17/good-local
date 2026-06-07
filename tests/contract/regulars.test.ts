// ============================================================
// regulars.test.ts — contract §3.10 get_business_regulars (added T064).
// Art. V: the list is the owner's business only; display_name may be null
// (anonymous patrons) — never an invented name.
// ============================================================
import { beforeAll, describe, expect, it } from "vitest";
import {
  SEED,
  adminClient,
  anonPatronClient,
  ensureSeedAuthPasswords,
  ownerClient,
  serviceClient,
} from "../integration/helpers";

const svc = serviceClient();

describe("get_business_regulars (contract §3.10)", () => {
  let owner: Awaited<ReturnType<typeof ownerClient>>;

  beforeAll(async () => {
    await ensureSeedAuthPasswords();
    owner = await ownerClient();
  });

  it("returns the regulars shape for the owner's business", async () => {
    // Arrange: one patron with 2 stamps at The Heron (a verified regular).
    const { client: patron, userId } = await anonPatronClient();
    const { error: ciErr } = await patron.rpc("record_check_in", {
      p_business_slug: SEED.businessSlug,
      p_code_value: SEED.codeValue,
      p_device_ref: `reg-${crypto.randomUUID()}`,
    });
    expect(ciErr).toBeNull();
    // Resolve THIS patron deterministically via the session user (latest-stamp
    // lookups race with same-second stamps from other suites).
    const { data: patronRow } = await svc
      .from("patrons")
      .select("id")
      .eq("auth_user_id", userId)
      .single();
    const { data: season, error: seasonErr } = await svc
      .from("seasons").select("id").eq("is_current", true).single();
    expect(seasonErr).toBeNull();
    const { data: code, error: codeErr } = await svc
      .from("check_in_codes")
      .select("id")
      .eq("business_id", SEED.businessId)
      .eq("status", "current")
      .single();
    expect(codeErr).toBeNull();
    // Region-tz boundary safety: derive "yesterday" from the actual stamp's
    // local_date (UTC math drifts after 8pm EDT — same class as the dashboard
    // ISO-week fix; see docs/solutions/).
    const { data: todayStamp } = await svc
      .from("stamps")
      .select("local_date")
      .eq("patron_id", patronRow!.id)
      .eq("business_id", SEED.businessId)
      .single();
    const d = new Date(`${todayStamp!.local_date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    const yesterday = d.toISOString().slice(0, 10);
    const { error: insErr } = await svc.from("stamps").insert({
      patron_id: patronRow!.id,
      business_id: SEED.businessId,
      season_id: season!.id,
      local_date: yesterday,
      code_version_ref: code!.id,
    });
    expect(insErr).toBeNull();

    const { data, error } = await owner.rpc("get_business_regulars", { p_business_id: SEED.businessId });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    const row = (data as any[]).find((r) => r.patron_ref === patronRow!.id);
    expect(row).toBeTruthy();
    expect(row.visits).toBeGreaterThanOrEqual(2);
    expect(row).toHaveProperty("display_name"); // may be null — honest, never invented
    expect(row.since <= row.last_visit).toBe(true);
    expect(["new", "up", "steady"]).toContain(row.trend);
  });

  it("admin may pass any business_id", async () => {
    const admin = await adminClient();
    const { data, error } = await admin.rpc("get_business_regulars", {
      p_business_id: SEED.businessId,
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("a non-owner gets FORBIDDEN (Art. V boundary)", async () => {
    const { client: patron } = await anonPatronClient();
    const { error } = await patron.rpc("get_business_regulars", {
      p_business_id: SEED.businessId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("FORBIDDEN");
  });
});
