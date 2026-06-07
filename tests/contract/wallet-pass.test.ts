// ===========================================================================
// wallet-pass.test.ts — D-020 contract tests for add_wallet_pass (§2.7).
//
// add_wallet_pass writes the `passport_adds` gate input (≥500 by Jul 31 sample
// floor — FR-033), so its contract is launch-blocking despite being one row:
//   - success shape: { serial, platform }
//   - idempotent per patron × platform: a repeat call upserts (same row,
//     refreshed last_updated_at), never a second wallet_pass_instances row
//   - unknown platform coerces to 'google' (the web passport)
//   - unauthenticated callers are rejected (no anonymous-of-anonymous writes)
//
// Found uncontracted + untested by the 2026-06-07 arch audit; this file closes
// that gap (same class as D-019 / get_business_regulars).
// ===========================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serviceClient, anonPatronClient } from "../integration/helpers";

// Same env convention as helpers.ts (module-private there).
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.API_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = (process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY)!;

let svc: SupabaseClient;

async function patronIdFor(client: SupabaseClient): Promise<string> {
  // First touch creates the patrons row (same trick as identity.test.ts).
  await client.rpc("link_device", { p_device_token: `wp-${Math.random().toString(36).slice(2)}` });
  const { data } = await client.auth.getUser();
  const row = await svc
    .from("patrons")
    .select("id")
    .eq("auth_user_id", data.user!.id)
    .single();
  if (row.error || !row.data) throw new Error(`no patron row: ${row.error?.message}`);
  return row.data.id as string;
}

beforeAll(async () => {
  svc = serviceClient();
});

describe("add_wallet_pass (§2.7 — the passport_adds gate writer)", () => {
  it("returns { serial, platform } and writes one wallet_pass_instances row", async () => {
    const session = await anonPatronClient();
    const patronId = await patronIdFor(session.client);

    const { data, error } = await session.client.rpc("add_wallet_pass", { p_platform: "apple" });
    expect(error).toBeNull();
    expect(typeof data.serial).toBe("string");
    expect(data.platform).toBe("apple");

    const rows = await svc
      .from("wallet_pass_instances")
      .select("patron_id, platform, serial")
      .eq("patron_id", patronId);
    expect(rows.data).toHaveLength(1);
    expect(rows.data![0].platform).toBe("apple");
    expect(rows.data![0].serial).toBe(data.serial);
  });

  it("is idempotent per patron × platform — repeat call upserts, never a second row", async () => {
    const session = await anonPatronClient();
    const patronId = await patronIdFor(session.client);

    const first = await session.client.rpc("add_wallet_pass", { p_platform: "google" });
    expect(first.error).toBeNull();
    const second = await session.client.rpc("add_wallet_pass", { p_platform: "google" });
    expect(second.error).toBeNull();

    // Same serial back (the existing row, refreshed) and exactly one row.
    expect(second.data.serial).toBe(first.data.serial);
    const rows = await svc
      .from("wallet_pass_instances")
      .select("id")
      .eq("patron_id", patronId)
      .eq("platform", "google");
    expect(rows.data).toHaveLength(1);
  });

  it("distinct platforms are distinct rows (apple + google for one patron)", async () => {
    const session = await anonPatronClient();
    const patronId = await patronIdFor(session.client);

    await session.client.rpc("add_wallet_pass", { p_platform: "apple" });
    await session.client.rpc("add_wallet_pass", { p_platform: "google" });

    const rows = await svc
      .from("wallet_pass_instances")
      .select("platform")
      .eq("patron_id", patronId);
    expect((rows.data ?? []).map((r) => r.platform).sort()).toEqual(["apple", "google"]);
  });

  it("unknown platform coerces to 'google' (the web passport)", async () => {
    const session = await anonPatronClient();
    await patronIdFor(session.client);

    const { data, error } = await session.client.rpc("add_wallet_pass", { p_platform: "homescreen" });
    expect(error).toBeNull();
    expect(data.platform).toBe("google");
  });

  it("unauthenticated → UNAUTHENTICATED (no session, no gate write)", async () => {
    // A bare anon-key client with NO signed-in session (anonymous or otherwise).
    const bare = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await bare.rpc("add_wallet_pass", { p_platform: "google" });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("UNAUTHENTICATED");
  });
});
