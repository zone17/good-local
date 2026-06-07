// ============================================================
// share-weekly-note/index.ts — Deno edge function (T051).
//
// POST { email } → email the owner's read-only weekly note to one co-owner
// (contracts §3.8, FR-030). Auth is the OWNER's JWT: we resolve the session
// user from the forwarded Authorization header (same wrapper pattern as
// create-checkout-session), so the dashboard read + share record both run
// under the caller's RLS scope.
//
// Flow:
//   1. Authenticate via getUser() on a user-scoped client (UNAUTHENTICATED 401
//      if missing/invalid — copies create-checkout-session).
//   2. Read the weekly_note from get_dashboard() under the caller's JWT.
//   3. Deliver via RESEND_API_KEY if configured; otherwise log + return
//      { sent:true, dev:true } gated NON-production + EXPOSE_DEV_MAIL=1
//      (fail-closed, mirroring the EXPOSE_DEV_OTP pattern in otp-core.ts).
//   4. Record the idempotency row via the share_weekly_note RPC (per week).
// ============================================================
// @ts-nocheck — Deno runtime; types resolved at deploy, not in the vitest tsconfig.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Whether dev-mail delivery may be skipped (logged) and reported as sent.
 * Fail-closed: requires an explicitly non-production environment AND the
 * dedicated EXPOSE_DEV_MAIL=1 opt-in. Unset environment = assume production.
 */
function devMailAllowed(environment: string | undefined, exposeFlag: string | undefined): boolean {
  const env = environment ?? "production";
  const envIsLocal = env === "development" || env === "local";
  return envIsLocal && exposeFlag === "1";
}

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

  const email = body.email;
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return json({ error: { code: "VALIDATION", message: "valid email required" } }, 422);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth: resolve the owner from the forwarded JWT (create-checkout-session pattern).
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: { code: "UNAUTHENTICATED", message: "sign in to share" } }, 401);
  }

  // Read the weekly note under the caller's RLS scope.
  const { data: dash, error: dashErr } = await userClient.rpc("get_dashboard", {
    p_business_id: null,
  });
  if (dashErr) {
    const code = (dashErr.message || "").trim();
    const status = code === "FORBIDDEN" ? 403 : code === "UNAUTHENTICATED" ? 401 : 422;
    return json({ error: { code: code || "FORBIDDEN", message: dashErr.message } }, status);
  }
  const weeklyNote = (dash && (dash as Record<string, unknown>).weekly_note) ?? "";

  // Deliver. Real send via Resend when configured; otherwise dev/log fallback.
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const environment = Deno.env.get("ENVIRONMENT");
  let dev = false;

  if (resendKey) {
    try {
      await sendViaResend(email, String(weeklyNote), resendKey);
    } catch (err) {
      return json({ error: { code: "VALIDATION", message: String(err) } }, 502);
    }
  } else {
    if (!devMailAllowed(environment, Deno.env.get("EXPOSE_DEV_MAIL"))) {
      return json(
        { error: { code: "VALIDATION", message: "email delivery not configured" } },
        500,
      );
    }
    console.log(`[share-weekly-note] to ${email}: ${weeklyNote} (no provider; dev fallback)`);
    dev = true;
  }

  // Record the idempotency row (per business per email per week).
  const { data: rec, error: recErr } = await userClient.rpc("share_weekly_note", {
    p_email: email,
  });
  if (recErr) {
    const code = (recErr.message || "").trim();
    const status = code === "FORBIDDEN" ? 403 : code === "VALIDATION" ? 422 : 422;
    return json({ error: { code: code || "VALIDATION", message: recErr.message } }, status);
  }

  const weekOf = (rec && (rec as Record<string, unknown>).week_of) ?? null;
  return json({ sent: true, week_of: weekOf, ...(dev ? { dev: true } : {}) }, 200);
});

async function sendViaResend(to: string, note: string, apiKey: string): Promise<void> {
  const from = Deno.env.get("RESEND_FROM") ?? "Good Local <notes@goodlocal.app>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Your Good Local weekly note",
      text: note,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
}

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
