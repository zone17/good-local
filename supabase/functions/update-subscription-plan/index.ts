// ============================================================
// update-subscription-plan/index.ts — Deno edge wrapper (T024).
//
// POST { action: 'winter' | 'founding' }. Resolves the caller's auth.uid()
// from the JWT, then delegates to the pure core. The local subscriptions row
// is never written here — the Stripe webhook is the single writer (R4). All
// logic lives in core.ts.
// ============================================================
// @ts-nocheck — Deno runtime; types resolved at deploy, not in the vitest tsconfig.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { changePlan, PlanError } from "./core.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: { code: "VALIDATION" } }, 405);

  // Identify the caller from their JWT (anon-key client + Authorization header).
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: userData } = await userClient.auth.getUser();
  const ownerUserId = userData?.user?.id;
  if (!ownerUserId) return json({ error: { code: "UNAUTHENTICATED" } }, 401);

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: { code: "VALIDATION", message: "invalid json" } }, 400);
  }
  const action = body.action;
  if (action !== "winter" && action !== "founding") {
    return json({ error: { code: "VALIDATION", message: "action" } }, 422);
  }

  // Service-role client for the DB reads the core needs (subscription lookup);
  // it still does not WRITE the subscriptions row (webhook is the writer).
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const result = await changePlan(action, {
      db,
      fetchImpl: fetch,
      ownerUserId,
      env: {
        STRIPE_SECRET_KEY: Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_local",
        STRIPE_PRICE_WINTER: Deno.env.get("STRIPE_PRICE_WINTER") ?? undefined,
        STRIPE_PRICE_FOUNDING: Deno.env.get("STRIPE_PRICE_FOUNDING") ?? undefined,
      },
    });
    return json(result, 200);
  } catch (err) {
    if (err instanceof PlanError) {
      const status =
        err.code === "OUTSIDE_WINTER_WINDOW" ? 409 : err.code === "STRIPE_ERROR" ? 502 : 403;
      return json({ error: { code: err.code, message: err.message } }, status);
    }
    return json({ error: { code: "VALIDATION", message: String(err) } }, 500);
  }
});

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
