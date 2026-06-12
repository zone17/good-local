// ============================================================
// billing-cores.test.ts — the money paths, finally under test
// (audit TEST-001: the only contracted verbs with zero coverage).
//
// Both cores are dependency-injected (db / fetchImpl / env), so these are
// pure contract tests: stubbed Stripe + stubbed PostgREST chains, asserting
// the §3.1 / §3.9 behaviors including the failure paths that shipped bugs:
//   - ERR-011: a skipped price swap must be STRIPE_ERROR, never success
//   - ERR-010/API-002: checkout retries resume; Stripe failure leaves no orphan
// ============================================================
import { describe, it, expect } from "vitest";
import { changePlan, PlanError, inWinterWindow } from "../../supabase/functions/update-subscription-plan/core";
import { buildCheckout, CheckoutError } from "../../supabase/functions/create-checkout-session/core";

// ---- tiny PostgREST chain stub --------------------------------
// Each db.from(table) consumes the next queued result for that table and
// returns an endlessly chainable object that resolves to it. Every method
// call is logged as `table.method` for behavioral assertions.

type QueueMap = Record<string, unknown[]>;

function makeDb(queues: QueueMap, log: string[]) {
  const chain = (table: string, result: unknown): any =>
    new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            return (res: any, rej: any) => Promise.resolve(result).then(res, rej);
          }
          if (prop === "maybeSingle" || prop === "single") {
            return () => {
              log.push(`${table}.${prop}`);
              return Promise.resolve(result);
            };
          }
          return (..._args: unknown[]) => {
            log.push(`${table}.${prop}`);
            return chain(table, result);
          };
        },
      },
    );
  return {
    from(table: string) {
      const q = queues[table];
      if (!q || q.length === 0) throw new Error(`stub: unexpected query on ${table}`);
      return chain(table, q.shift());
    },
  };
}

const okStripe = (url = "https://checkout.stripe.com/c/test") => async () =>
  ({ ok: true, json: async () => ({ url, data: [{ id: "si_1" }] }), text: async () => "" }) as any;

const failStripe = (status = 402) => async () =>
  ({ ok: false, status, json: async () => ({}), text: async () => "card declined" }) as any;

// ============================================================
// update-subscription-plan (§3.9)
// ============================================================

const DECEMBER = new Date("2026-12-05T12:00:00Z");
const JULY = new Date("2026-07-05T12:00:00Z");

function planDeps(overrides: Partial<any> = {}) {
  const log: string[] = [];
  const queues: QueueMap = {
    businesses: [{ data: { id: "b1" } }],
    subscriptions: [{ data: { stripe_subscription_id: "sub_1", founding_price_id: "price_f" } }],
  };
  return {
    log,
    deps: {
      db: makeDb(queues, log),
      fetchImpl: okStripe(),
      env: { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_WINTER: "price_w", STRIPE_PRICE_FOUNDING: "price_f" },
      ownerUserId: "u1",
      now: DECEMBER,
      ...overrides,
    } as any,
  };
}

describe("changePlan — winter window", () => {
  it("computes the window in America/New_York", () => {
    expect(inWinterWindow(DECEMBER)).toBe(true);
    expect(inWinterWindow(JULY)).toBe(false);
  });

  it("rejects winter outside Nov–Apr with OUTSIDE_WINTER_WINDOW", async () => {
    const { deps } = planDeps({ now: JULY });
    await expect(changePlan("winter", deps)).rejects.toMatchObject({ code: "OUTSIDE_WINTER_WINDOW" });
  });
});

describe("changePlan — success only when the swap actually happened", () => {
  it("returns the winter projection after both Stripe calls succeed", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init?: any) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      return (await okStripe()()) as any;
    }) as any;
    const { deps } = planDeps({ fetchImpl });
    const out = await changePlan("winter", deps);
    expect(out).toEqual({ plan: "winter", monthly: 49, founding_rate_preserved: true });
    expect(calls.some((c) => c.startsWith("GET") && c.includes("subscription_items?subscription=sub_1"))).toBe(true);
    expect(calls.some((c) => c.startsWith("POST") && c.includes("subscription_items/si_1"))).toBe(true);
  });

  it("ERR-011 regression: a failed item lookup is STRIPE_ERROR, never silent success", async () => {
    const { deps } = planDeps({ fetchImpl: failStripe(500) });
    await expect(changePlan("winter", deps)).rejects.toMatchObject({ code: "STRIPE_ERROR" });
  });

  it("ERR-011 regression: a subscription with no items is STRIPE_ERROR, never silent success", async () => {
    const fetchImpl = (async () =>
      ({ ok: true, json: async () => ({ data: [] }), text: async () => "" }) as any) as any;
    const { deps } = planDeps({ fetchImpl });
    await expect(changePlan("winter", deps)).rejects.toMatchObject({ code: "STRIPE_ERROR" });
  });

  it("a failed swap POST is STRIPE_ERROR", async () => {
    let call = 0;
    const fetchImpl = (async () => {
      call += 1;
      if (call === 1) return { ok: true, json: async () => ({ data: [{ id: "si_1" }] }), text: async () => "" } as any;
      return { ok: false, status: 402, json: async () => ({}), text: async () => "nope" } as any;
    }) as any;
    const { deps } = planDeps({ fetchImpl });
    await expect(changePlan("winter", deps)).rejects.toMatchObject({ code: "STRIPE_ERROR" });
  });

  it("throws FORBIDDEN when the caller owns no business", async () => {
    const log: string[] = [];
    const deps = {
      db: makeDb({ businesses: [{ data: null }] }, log),
      fetchImpl: okStripe(),
      env: { STRIPE_SECRET_KEY: "sk" },
      ownerUserId: "u1",
      now: DECEMBER,
    } as any;
    await expect(changePlan("winter", deps)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(PlanError).toBeDefined();
  });
});

// ============================================================
// create-checkout-session (§3.1)
// ============================================================

const REQ = {
  business_name: "The Heron",
  owner_email: "mira@theheron.co",
  town: "narrowsburg",
  idempotency_key: "11111111-1111-4111-8111-111111111111",
};

function checkoutDeps(businessQueue: unknown[], extra: Partial<QueueMap> = {}, fetchImpl: any = okStripe()) {
  const log: string[] = [];
  const queues: QueueMap = {
    regions: [{ data: { id: "r1" } }],
    towns: [{ data: { id: "t1" } }],
    businesses: businessQueue,
    check_in_codes: [{ error: null }, ...((extra.check_in_codes as unknown[]) ?? [])],
    rotation_schedules: [{ error: null }, ...((extra.rotation_schedules as unknown[]) ?? [])],
  };
  const deps = {
    db: makeDb(queues, log),
    authedUser: { id: "u1", email: REQ.owner_email },
    fetchImpl,
    env: { STRIPE_SECRET_KEY: "sk_test_x" },
  } as any;
  return { deps, log, queues };
}

describe("buildCheckout — fresh signup", () => {
  it("creates the pending business and returns the checkout url", async () => {
    const { deps, log } = checkoutDeps([
      { data: null }, // idempotency replay lookup
      { data: null }, // dup lookup
      { data: [] }, // slug ilike
      { data: [] }, // stamp codes
      { data: { id: "b1" }, error: null }, // insert
    ]);
    const out = await buildCheckout(REQ as any, deps);
    expect(out.business_id).toBe("b1");
    expect(out.checkout_url).toContain("checkout.stripe.com");
    expect(log).toContain("businesses.insert");
    expect(log).toContain("check_in_codes.insert");
  });

  it("ERR-010 regression: Stripe failure rolls back the rows it created", async () => {
    const { deps, log } = checkoutDeps(
      [
        { data: null },
        { data: null },
        { data: [] },
        { data: [] },
        { data: { id: "b1" }, error: null }, // insert
        { error: null }, // businesses delete (cleanup)
      ],
      { check_in_codes: [{ error: null }], rotation_schedules: [{ error: null }] },
      failStripe(),
    );
    await expect(buildCheckout(REQ as any, deps)).rejects.toMatchObject({ code: "STRIPE_ERROR" });
    // The cleanup deletes ran for all three tables.
    expect(log.filter((l) => l.endsWith(".delete"))).toEqual([
      "check_in_codes.delete",
      "rotation_schedules.delete",
      "businesses.delete",
    ]);
  });
});

describe("buildCheckout — resume paths (API-002)", () => {
  it("replays the same idempotency_key to the original business with a fresh session", async () => {
    const { deps, log } = checkoutDeps([
      { data: { id: "b9", owner_user_id: "u1" } }, // idempotency hit
    ]);
    const out = await buildCheckout(REQ as any, deps);
    expect(out.business_id).toBe("b9");
    expect(log).not.toContain("businesses.insert");
  });

  it("resumes the caller's own pending signup instead of DUPLICATE_PENDING", async () => {
    const { deps, log } = checkoutDeps([
      { data: null }, // no idempotency hit (new key, retry after abandon)
      { data: { id: "b7", owner_user_id: "u1" } }, // dup owned by caller
    ]);
    const out = await buildCheckout(REQ as any, deps);
    expect(out.business_id).toBe("b7");
    expect(log).not.toContain("businesses.insert");
  });

  it("still rejects someone else's pending signup with DUPLICATE_PENDING", async () => {
    const { deps } = checkoutDeps([
      { data: null },
      { data: { id: "b7", owner_user_id: "u2" } },
    ]);
    await expect(buildCheckout(REQ as any, deps)).rejects.toMatchObject({ code: "DUPLICATE_PENDING" });
  });

  it("rejects a replayed key owned by another account with FORBIDDEN", async () => {
    const { deps } = checkoutDeps([{ data: { id: "b9", owner_user_id: "u2" } }]);
    await expect(buildCheckout(REQ as any, deps)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(CheckoutError).toBeDefined();
  });
});
