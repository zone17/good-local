// ============================================================
// claim-passport/index.ts — Deno edge function (T029).
//
// Two POST paths (contracts §2.3, §3.5 claim-link delegation):
//   { phone }        → mint a 6-digit OTP, store it (otp_codes, 10-min expiry),
//                      "send" it via the messaging provider. With no TWILIO_*
//                      secrets configured we log + (outside production) return
//                      dev_otp so local/dev can complete the flow.
//   { phone, otp }   → proxy to the claim_passport RPC under the CALLER's JWT
//                      (forward the Authorization header to a user-scoped client)
//                      so the merge attaches to the right anon/auth identity.
//
// The OTP is INSERTED with the service-role client (otp_codes has no app-role
// RLS policies — service-role only). The RPC call uses a user-scoped client so
// auth.uid() inside claim_passport resolves to the caller (R3 merge target).
// ============================================================
// @ts-nocheck — Deno runtime; types resolved at deploy, not in the vitest tsconfig.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateOtp, isE164, devOtpAllowed } from "../_shared/otp-core.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return json({ error: { code: "VALIDATION", message: "POST only" } }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: { code: "VALIDATION", message: "invalid json" } }, 400);
  }

  const phone = body.phone;
  if (!isE164(phone)) {
    return json({ error: { code: "PHONE_INVALID", message: "phone must be E.164" } }, 422);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ---- verify path: { phone, otp } → proxy to claim_passport under caller JWT ----
  if (typeof body.otp === "string" && body.otp.length > 0) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return json({ error: { code: "UNAUTHENTICATED", message: "missing Authorization" } }, 401);
    }
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data, error } = await userClient.rpc("claim_passport", {
      p_phone: phone,
      p_otp: body.otp,
    });
    if (error) {
      // claim_passport raises errcode P0001 with MESSAGE = the §7 code.
      const code = (error.message || "").trim();
      const known = ["OTP_INVALID", "OTP_EXPIRED", "UNAUTHENTICATED", "RATE_LIMITED", "INVALID_STATE"]
        .includes(code);
      const status =
        code === "OTP_EXPIRED" ? 410
        : code === "UNAUTHENTICATED" ? 401
        : code === "RATE_LIMITED" ? 429
        : code === "INVALID_STATE" ? 409
        : 422;
      return json({ error: { code: known ? code : "OTP_INVALID", message: error.message } }, status);
    }
    return json(data, 200);
  }

  // ---- send path: { phone } → mint + store OTP, deliver via provider ----
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Send cap (review P1-3): at most 5 OTP sends per phone per hour. otp_codes
  // is service-role-only, so this edge fn is the single door for sends — the
  // cap here is complete. (Verify-side brute force is limited in the RPC.)
  const sinceIso = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count: recentSends, error: cntErr } = await db
    .from("otp_codes")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .gte("created_at", sinceIso);
  if (cntErr) {
    return json({ error: { code: "VALIDATION", message: cntErr.message } }, 500);
  }
  if ((recentSends ?? 0) >= 5) {
    return json(
      { error: { code: "RATE_LIMITED", message: "too many codes requested; try again later" } },
      429,
    );
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  const { error: insErr } = await db
    .from("otp_codes")
    .insert({ phone, code, expires_at: expiresAt });
  if (insErr) {
    return json({ error: { code: "VALIDATION", message: insErr.message } }, 500);
  }

  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const environment = Deno.env.get("ENVIRONMENT");

  if (twilioSid && twilioToken) {
    // Production-ish: send via the messaging provider (kept minimal — the
    // contract only fixes the interface, not the carrier). Failures here are
    // surfaced as RATE_LIMITED/VALIDATION rather than leaking the code.
    try {
      await sendViaTwilio(phone, code, { twilioSid, twilioToken });
    } catch (err) {
      return json({ error: { code: "VALIDATION", message: String(err) } }, 502);
    }
    return json({ sent: true }, 200);
  }

  // No provider configured: log it. Expose dev_otp ONLY outside production so
  // local/dev and tests can finish the claim without an SMS round-trip.
  console.log(`[claim-passport] OTP for ${phone}: ${code} (no messaging provider configured)`);
  const payload: Record<string, unknown> = { sent: true };
  if (devOtpAllowed(environment, Deno.env.get("EXPOSE_DEV_OTP"))) {
    payload.dev_otp = code; // dev/local only — never returned in production
  }
  return json(payload, 200);
});

async function sendViaTwilio(
  phone: string,
  code: string,
  cfg: { twilioSid: string; twilioToken: string },
): Promise<void> {
  const from = Deno.env.get("TWILIO_FROM");
  const auth = btoa(`${cfg.twilioSid}:${cfg.twilioToken}`);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${cfg.twilioSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: from ?? "",
        Body: `Your Good Local passport code is ${code}. It expires in 10 minutes.`,
      }),
    },
  );
  if (!res.ok) throw new Error(`twilio ${res.status}`);
}

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
