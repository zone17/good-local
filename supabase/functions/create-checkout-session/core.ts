// ============================================================
// create-checkout-session/core.ts — pure signup→billing logic (T019).
//
// Contracts §3.1. Validates the town, ensures an owner auth user + a pending
// business row exist (as the signup handoff requires), then builds the Stripe
// Checkout-session request and returns { checkout_url, business_id }.
//
// Pure-ish: all IO is injected (db = service supabase client; auth = admin API;
// fetchImpl = the HTTP client used to call Stripe; env = secrets). index.ts
// wires the Deno runtime + real implementations. This shape lets the logic be
// unit-tested without a live Stripe or Deno.
//
// Errors are thrown as { code } objects (§7 machine codes); index.ts maps them
// to the §1.2 envelope.
// ============================================================

export class CheckoutError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

export interface CheckoutDeps {
  // service-role supabase client (structural subset — data tables only; this
  // core deliberately has NO auth.admin surface, see authedUser below).
  db: {
    from(table: string): any;
  };
  /**
   * The already-authenticated caller, resolved by index.ts from the request's
   * Authorization JWT via auth.getUser(). SECURITY (review 2026-06-06):
   * unauthenticated callers could previously squat any email via
   * admin.createUser({ email_confirm: true }) — pre-account-takeover. The
   * client flow signs up first (Signup.jsx -> signUpOwner), so the edge fn
   * now REQUIRES that session and never creates or confirms users itself.
   */
  authedUser: { id: string; email: string | null };
  fetchImpl: typeof fetch;
  env: {
    STRIPE_SECRET_KEY: string;
    SITE_URL?: string;
    STRIPE_PRICE_FOUNDING?: string;
  };
}

export interface CheckoutRequest {
  business_name: string;
  owner_email: string;
  town: string; // town slug
  idempotency_key: string;
}

const KEBAB = /[^a-z0-9]+/g;

export function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(KEBAB, "-")
    .replace(/^-+|-+$/g, "");
}

// First 3 consonant-ish uppercase letters of the name; pad/fallback to 'BIZ'.
export function deriveStampCode(name: string, taken: Set<string>): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  const consonants = letters.replace(/[AEIOU]/g, "");
  let base = (consonants.length >= 3 ? consonants : letters).slice(0, 3);
  if (base.length < 3) base = (base + "BIZ").slice(0, 3);

  if (!taken.has(base)) return base;
  // Collision: append a 4th letter A..Z, then fall back to other 3-letter tries.
  for (let i = 0; i < 26; i++) {
    const cand = (base + String.fromCharCode(65 + i)).slice(0, 4);
    if (!taken.has(cand)) return cand;
  }
  return base; // extremely unlikely; DB unique will surface a clear error
}

export async function buildCheckout(
  req: CheckoutRequest,
  deps: CheckoutDeps,
): Promise<{ checkout_url: string; business_id: string }> {
  const { db, fetchImpl, env } = deps;

  // ---- validate ----
  if (!req.business_name?.trim()) throw new CheckoutError("VALIDATION", "business_name");
  if (!req.owner_email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(req.owner_email)) {
    throw new CheckoutError("VALIDATION", "owner_email");
  }
  if (!req.idempotency_key) throw new CheckoutError("VALIDATION", "idempotency_key");

  // Region (v1: exactly one).
  const { data: region } = await db.from("regions").select("id").limit(1).maybeSingle();
  if (!region) throw new CheckoutError("REGION_NOT_FOUND");

  // Town must exist in the region.
  const { data: town } = await db
    .from("towns")
    .select("id")
    .eq("slug", req.town)
    .eq("region_id", region.id)
    .maybeSingle();
  if (!town) throw new CheckoutError("VALIDATION", "town");

  // DUPLICATE_PENDING: a pending business with the same name + town exists.
  const { data: dup } = await db
    .from("businesses")
    .select("id")
    .eq("town_id", town.id)
    .eq("name", req.business_name.trim())
    .eq("status", "pending")
    .maybeSingle();
  if (dup) throw new CheckoutError("DUPLICATE_PENDING");

  // ---- owner = the authenticated caller, full stop ----
  // The caller proved control of this email by signing up/in before checkout;
  // we only assert the request matches the session it rides on.
  const { authedUser } = deps;
  if (!authedUser?.id) throw new CheckoutError("UNAUTHENTICATED");
  if ((authedUser.email ?? "").toLowerCase() !== req.owner_email.toLowerCase()) {
    throw new CheckoutError("FORBIDDEN", "owner_email does not match session");
  }
  const ownerId = authedUser.id;

  // ---- slug + stamp_code (dedupe) ----
  let slug = kebab(req.business_name) || "business";
  {
    const { data: existing } = await db.from("businesses").select("slug").ilike("slug", `${slug}%`);
    const slugs = new Set<string>((existing ?? []).map((r: any) => r.slug));
    if (slugs.has(slug)) {
      let n = 2;
      while (slugs.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
  }

  let stampCode: string;
  {
    const { data: codes } = await db
      .from("businesses")
      .select("stamp_code")
      .eq("region_id", region.id);
    const taken = new Set<string>((codes ?? []).map((r: any) => r.stamp_code));
    stampCode = deriveStampCode(req.business_name, taken);
  }

  // ---- create the pending business ----
  const { data: biz, error: bizErr } = await db
    .from("businesses")
    .insert({
      region_id: region.id,
      town_id: town.id,
      owner_user_id: ownerId,
      name: req.business_name.trim(),
      slug,
      category: "uncategorized",
      hours: {},
      stamp_code: stampCode,
      status: "pending",
    })
    .select("id")
    .single();
  if (bizErr || !biz) throw new CheckoutError("VALIDATION", bizErr?.message ?? "business");

  // Seed the first current code + rotation schedule so the kit is printable on
  // day one (the webhook later activates billing; admin approval activates the
  // business itself).
  await db.from("check_in_codes").insert({
    business_id: biz.id,
    value: crypto.randomUUID().replace(/-/g, ""),
    version: 1,
    status: "current",
  });
  await db.from("rotation_schedules").insert({ business_id: biz.id });

  // ---- Stripe Checkout session (form-encoded) ----
  const siteUrl = env.SITE_URL ?? "https://goodlocal.app";
  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("success_url", `${siteUrl}/business?signup=pending`);
  form.set("cancel_url", `${siteUrl}/business/signup?canceled=1`);
  form.set("customer_email", req.owner_email);
  form.set("metadata[business_id]", biz.id);
  form.set("subscription_data[metadata][business_id]", biz.id);

  if (env.STRIPE_PRICE_FOUNDING) {
    form.set("line_items[0][price]", env.STRIPE_PRICE_FOUNDING);
    form.set("line_items[0][quantity]", "1");
  } else {
    // Inline $79/mo recurring price (no pre-created price needed locally).
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "usd");
    form.set("line_items[0][price_data][unit_amount]", "7900");
    form.set("line_items[0][price_data][recurring][interval]", "month");
    form.set("line_items[0][price_data][product_data][name]", "Good Local — Founding");
  }

  const resp = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": req.idempotency_key,
    },
    body: form.toString(),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new CheckoutError("STRIPE_ERROR", detail.slice(0, 200));
  }
  const session = (await resp.json()) as { url?: string };
  if (!session.url) throw new CheckoutError("STRIPE_ERROR", "no checkout url");

  return { checkout_url: session.url, business_id: biz.id };
}
