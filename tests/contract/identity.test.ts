// ===========================================================================
// identity.test.ts — T027 [US2] contract tests for claim_passport + link_device.
//
// Claim/merge per R3 (Art. XIV — both histories preserved, no row deleted):
//   - An anon patron (current JWT) claims a phone that another anon patron
//     already holds → merge. Winner = the oldest patron with that phone (or
//     the current one when no prior phone patron exists). Loser.merged_into is
//     set; loser stamps re-pointed to winner; loser row PRESERVED.
//   - Daily-unique conflict on merge (same business same day in both) →
//     loser's duplicate stamp is voided (trust_valid=false, void_reason
//     'merge-duplicate') instead of violating the unique constraint.
//   - current_patron_id() resolution follows merged_into.
//
// OTP send is external; the test exercises the RPC layer directly by inserting
// an otp_codes row via service role, then calling claim_passport(phone, otp).
//
// link_device adds a patron_devices row; a duplicate token → DEVICE_ALREADY_LINKED.
// ===========================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import { SEED, serviceClient, anonPatronClient } from "../integration/helpers";

let svc: SupabaseClient;
let seasonId: string;
let codeAId: string;

async function patronIdFor(userId: string): Promise<string> {
  const { data, error } = await svc
    .from("patrons")
    .select("id")
    .eq("auth_user_id", userId)
    .single();
  if (error || !data) throw new Error(`no patron for ${userId}: ${error?.message}`);
  return data.id as string;
}

/** Ensure the current anon JWT has a patrons row (record_check_in or first touch does this). */
async function ensurePatronRow(client: SupabaseClient): Promise<string> {
  // A cheap first-touch: link_device creates the patron if absent.
  await client.rpc("link_device", { p_device_token: `seed-${Math.random().toString(36).slice(2)}` });
  const { data } = await client.auth.getUser();
  return patronIdFor(data.user!.id);
}

async function insertOtp(phone: string, code: string, minutesValid = 10) {
  const { error } = await svc.from("otp_codes").insert({
    phone,
    code,
    expires_at: new Date(Date.now() + minutesValid * 60_000).toISOString(),
  });
  if (error) throw new Error(`insert otp failed: ${error.message}`);
}

beforeAll(async () => {
  svc = serviceClient();
  const s = await svc.from("seasons").select("id").eq("is_current", true).single();
  seasonId = s.data!.id as string;
  const c = await svc
    .from("check_in_codes")
    .select("id")
    .eq("business_id", SEED.businessId)
    .eq("status", "current")
    .single();
  codeAId = c.data!.id as string;
});

describe("claim_passport — merge preserves both histories (R3, Art. XIV)", () => {
  it("merges two anon patrons by phone; loser preserved + re-pointed", async () => {
    const phone = `+1845555${Math.floor(1000 + Math.random() * 8999)}`;

    // Loser: a pre-existing patron that already holds the phone, with a stamp.
    const loserSession = await anonPatronClient();
    const loserId = await ensurePatronRow(loserSession.client);
    await svc.from("patrons").update({ phone, claimed_at: new Date().toISOString() }).eq("id", loserId);
    const loserStamp = await svc
      .from("stamps")
      .insert({
        patron_id: loserId,
        business_id: SEED.businessId,
        season_id: seasonId,
        local_date: new Date(Date.now() - 5 * 86400_000).toISOString().slice(0, 10),
        code_version_ref: codeAId,
        trust_valid: true,
      })
      .select("id")
      .single();
    expect(loserStamp.error).toBeNull();

    // Winner-candidate is the CURRENT session (a different anon patron) that
    // claims the same phone. Because a prior patron already holds the phone,
    // the prior (oldest) is the winner; the current session merges INTO it.
    const claimerSession = await anonPatronClient();
    const claimerId = await ensurePatronRow(claimerSession.client);
    await svc
      .from("stamps")
      .insert({
        patron_id: claimerId,
        business_id: SEED.businessId,
        season_id: seasonId,
        local_date: new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10),
        code_version_ref: codeAId,
        trust_valid: true,
      });

    const code = "123456";
    await insertOtp(phone, code);

    const { data, error } = await claimerSession.client.rpc("claim_passport", {
      p_phone: phone,
      p_otp: code,
    });
    expect(error).toBeNull();
    expect(data.claimed).toBe(true);
    expect(typeof data.patron_id).toBe("string");
    expect(Array.isArray(data.merged_from)).toBe(true);
    expect(data.merged_from.length).toBeGreaterThanOrEqual(1);

    // Winner is the oldest (loserId, which held the phone first).
    const winnerId = data.patron_id as string;
    expect(winnerId).toBe(loserId);

    // The loser (current session's patron) row is PRESERVED with merged_into set.
    const merged = await svc
      .from("patrons")
      .select("id, merged_into")
      .eq("id", claimerId)
      .single();
    expect(merged.data!.merged_into).toBe(winnerId);

    // Both stamps now point at the winner (re-pointed history).
    const winnerStamps = await svc.from("stamps").select("id").eq("patron_id", winnerId);
    expect((winnerStamps.data ?? []).length).toBeGreaterThanOrEqual(2);

    // current_patron_id() for the claimer session resolves to the winner.
    const resolved = await claimerSession.client.rpc("current_patron_id");
    expect(resolved.data).toBe(winnerId);
  });

  it("daily-unique merge conflict voids loser duplicate with 'merge-duplicate'", async () => {
    const phone = `+1845555${Math.floor(1000 + Math.random() * 8999)}`;
    const day = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);

    // Phone-holder (winner) with a stamp at The Heron on `day`.
    const winnerSession = await anonPatronClient();
    const winnerId = await ensurePatronRow(winnerSession.client);
    await svc.from("patrons").update({ phone }).eq("id", winnerId);
    await svc.from("stamps").insert({
      patron_id: winnerId,
      business_id: SEED.businessId,
      season_id: seasonId,
      local_date: day,
      code_version_ref: codeAId,
      trust_valid: true,
    });

    // Claimer (loser) with a CONFLICTING stamp at the same business on the same day.
    const claimerSession = await anonPatronClient();
    const loserId = await ensurePatronRow(claimerSession.client);
    const loserStamp = await svc
      .from("stamps")
      .insert({
        patron_id: loserId,
        business_id: SEED.businessId,
        season_id: seasonId,
        local_date: day,
        code_version_ref: codeAId,
        trust_valid: true,
      })
      .select("id")
      .single();
    expect(loserStamp.error).toBeNull();

    const code = "654321";
    await insertOtp(phone, code);
    const { error } = await claimerSession.client.rpc("claim_passport", {
      p_phone: phone,
      p_otp: code,
    });
    expect(error).toBeNull();

    // The loser's duplicate stamp is voided (history preserved, not deleted).
    const voided = await svc
      .from("stamps")
      .select("id, patron_id, trust_valid, void_reason")
      .eq("id", loserStamp.data!.id)
      .single();
    expect(voided.data!.trust_valid).toBe(false);
    expect(voided.data!.void_reason).toBe("merge-duplicate");

    // Winner keeps exactly one valid stamp on that day.
    const winnerDay = await svc
      .from("stamps")
      .select("id, trust_valid")
      .eq("patron_id", winnerId)
      .eq("business_id", SEED.businessId)
      .eq("local_date", day);
    const valid = (winnerDay.data ?? []).filter((r) => r.trust_valid);
    expect(valid).toHaveLength(1);
  });

  it("invalid OTP → OTP_INVALID", async () => {
    const phone = `+1845555${Math.floor(1000 + Math.random() * 8999)}`;
    const session = await anonPatronClient();
    await ensurePatronRow(session.client);
    const { error } = await session.client.rpc("claim_passport", {
      p_phone: phone,
      p_otp: "000000",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("OTP_INVALID");
  });
});

describe("link_device (contract §2.3)", () => {
  it("adds a device; duplicate token → DEVICE_ALREADY_LINKED", async () => {
    const session = await anonPatronClient();
    await ensurePatronRow(session.client);
    const token = `link-${Date.now()}`;

    const first = await session.client.rpc("link_device", { p_device_token: token });
    expect(first.error).toBeNull();
    expect(typeof first.data.linked_devices).toBe("number");

    const dup = await session.client.rpc("link_device", { p_device_token: token });
    expect(dup.error).not.toBeNull();
    expect(dup.error!.message).toContain("DEVICE_ALREADY_LINKED");
  });
});
