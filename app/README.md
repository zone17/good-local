# Good Local — App

The production web app for Good Local: the **Upper Delaware Passport** (patron
mobile web), the **business owner dashboard**, and the **internal admin**. The
app is a Vite + React SPA wired live against a Supabase backend (Postgres + Auth
+ RLS + Edge Functions). The design system at `../design` is the canonical
visual source — surfaces consume it, never fork it (Constitution Art. VIII).

## Routes

| Route | Surface | Entry bundle |
|---|---|---|
| `/` | Patron mobile web — passport home, discover/steer, me (≤560px lane) | `index.html` (main) |
| `/c/{slug}?k={code}` | Check-in landing — what the register QR encodes; earns a stamp | `checkin.html` (lean) |
| `/business` | Owner dashboard — weekly note, perks + builder, regulars, QR kit, settings | `index.html` (main) |
| `/business/signup` | Owner onboarding — details, identity, Stripe Checkout handoff | `index.html` (main) |
| `/admin` | Internal admin — approvals, picks curation, rotation, gate dashboard | `index.html` (main) |

The `/c/` route is served by a separate lean entry so the register-scan moment
never pays for the dashboard bundle (R7, Art. IX). In `vite dev` a middleware
rewrites `/c/*` → `/checkin.html`; in production the host rewrites it (e.g.
Vercel `rewrites`: `{ "source": "/c/(.*)", "destination": "/checkin.html" }`).

## Run it locally

You need the full stack: Supabase local (Postgres + Auth + Edge Functions) plus
the Vite dev server. See the repo `specs/001-upper-delaware-passport/quickstart.md`
for the validation scenarios; this is the short path.

```bash
# 1. Boot the backend and seed the baseline.
supabase start            # Postgres, Auth, Studio, edge runtime
supabase db reset         # applies supabase/migrations/* then supabase/seed/*
```

The reset seeds one region (Upper Delaware) + 12 towns, the `gate_thresholds`
rows, and one demo business **The Heron** (status `active`, one published perk,
one `current` check-in code). Note the seeded current code value printed by the
reset (or read it from Studio: `check_in_codes` where `status='current'` for The
Heron). Call it `<HERON_CODE>`.

Then run two terminals:

```bash
# Terminal A — serve edge functions with their secrets (see env table below).
supabase functions serve --env-file supabase/functions/.env

# Terminal B — the frontend, with VITE_ vars derived from the running stack.
cd app
npm install
# Pull API_URL / ANON_KEY from the local stack into .env.local, or inline them:
#   export $(supabase status -o env | grep -E 'API_URL|ANON_KEY')
#   VITE_SUPABASE_URL=$API_URL VITE_SUPABASE_ANON_KEY=$ANON_KEY npm run dev
npm run dev               # http://localhost:5173
```

The Playwright config derives `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
from `supabase status -o env` automatically, so the e2e suite needs no manual
`.env` editing as long as the local stack is running.

To exercise the subscription lifecycle, forward Stripe webhooks:

```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
# copy the printed whsec_… into STRIPE_WEBHOOK_SECRET, then restart functions
```

## Environment

Only `VITE_`-prefixed vars are exposed to the client bundle (see
`app/.env.example`). Everything else is an edge-function secret set via
`supabase secrets set` (deployed) or `supabase/functions/.env` (local).

### Client (`app/.env.local`)

| Var | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project / local API URL. `auth.js` throws at load if unset. |
| `VITE_SUPABASE_ANON_KEY` | Anonymous (publishable) key; safe for the browser, RLS enforces access. `auth.js` throws if unset. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe `pk_…` for the signup billing handoff. Never the secret key. |

### Edge-function secrets (server-only)

| Var | Used by | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | webhook, claim-passport | Service role; bypasses RLS. Server only. |
| `STRIPE_SECRET_KEY` | create-checkout-session, update-subscription-plan | Stripe `sk_…`. Card data never touches us. |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | `whsec_…`. Signature verified over raw bytes; bad signature = no writes. |
| `SITE_URL` | create-checkout-session | Checkout success/cancel base URL. Defaults to `https://goodlocal.app` if unset. |
| `STRIPE_PRICE_FOUNDING` | checkout, plan change | Founding $79 price id. |
| `STRIPE_PRICE_WINTER` | update-subscription-plan | Winter $49 price id. |
| `EXPOSE_DEV_OTP` | claim-passport | **Fail-closed.** Returns the dev OTP in the HTTP response only when env is non-production AND `EXPOSE_DEV_OTP=1`. Unset env = production = never exposed. |
| `EXPOSE_DEV_MAIL` | share-weekly-note | **Fail-closed**, same shape: dev mail short-circuit only when non-production AND `EXPOSE_DEV_MAIL=1`. |
| `RESEND_API_KEY` | share-weekly-note | Real mail delivery. Absent + dev affordance off = no send. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | claim-passport | SMS OTP delivery. Absent → relies on the fail-closed dev OTP path. |

Fail-closed note: the dev affordances (`EXPOSE_DEV_OTP`, `EXPOSE_DEV_MAIL`)
require BOTH a non-production environment AND the explicit `=1` opt-in. An unset
environment is treated as production — secrets are never leaked by default
(security review 2026-06-06).

## Architecture

```
app/
  index.html              — main SPA entry (patron / business / admin)
  checkin.html            — lean /c/ entry (3G budget, Art. IX)
  src/
    ds.js                 — design-system barrel re-exporting ../design components
    data.js               — legacy mock seam (being removed as screens go live; T064)
    lib/
      auth.js             — Supabase client singleton + identity helpers (shared gl-auth key)
      api.js              — the typed seam: one function per domain verb (RPCs / edge fns)
      errors.js           — normalizes Postgres/edge errors to ApiError (reads §7 code from message)
      pass.js             — PassIssuer adapter (wallet, A/B-deferred behind interface)
      towns.js, trace.js  — town lookup, lightweight tracing
    patron/               — PatronApp + screens
    business/             — BusinessApp + screens + staff check-in + RegisterKit (real QR)
    admin/                — approvals, picks, rotation, gate dashboard
    checkin/              — the lean scan-landing flow (own entry: main.jsx + checkin-api.js)
../design                 — canonical design system (consume-only)
../supabase               — Postgres migrations, RLS, views, RPCs, edge functions, seed
```

The **`api.js` seam is LIVE** against Supabase. Every mutation is either a
Postgres RPC (deterministic, RLS-aware) or an edge function (external
secret/service only). The constitution's hard invariants are enforced in the
database, not the client: the check-in trust model is a single Postgres
transaction (rotating code + per-day rate limit + dual attribution), the patron
privacy boundary is row-level security, and gate metrics are versioned SQL
views. The client never authorizes — it obtains a session and calls verbs.

**Shared identity.** Both the main bundle (`lib/auth.js`) and the lean check-in
bundle (`checkin/checkin-api.js`) construct the Supabase client with the same
`storageKey: "gl-auth"` and full session persistence. The scan and the passport
are therefore the same patron — one anonymous session spans both entries, so a
first scan and the passport home do not fork into two anonymous users.

**Two-entry performance budget** (gzipped JS, enforced in CI by
`.github/scripts/check-size.mjs`, hard-fail over budget — SC-008):

| Entry | Current | Budget |
|---|---|---|
| Check-in (`checkin.html`) | 50.5 KB | 60 KB |
| Main SPA (`index.html`) | 124.9 KB | 130 KB |

React is isolated into a named `react-vendor` chunk so the size gate attributes
the shared runtime to each entry's real graph.

## Principles (from the design README + Constitution)

- **Light pages** — weak rural cell signal is a launch constraint; the check-in
  entry stays under 60 KB and interactive < 3s on 3G-class (SC-008).
- **No emoji, no streak mechanics, no star ratings, no paid placement.**
- `../design` is canonical — visual changes happen there first; the app consumes.

## Testing

- **Vitest** (`npm test` at repo root) runs contract + integration + unit
  suites against the local Supabase stack. A `globalSetup` (`tests/setup/global-setup.ts`)
  runs `supabase db reset` once per invocation so every run starts from the
  seeded baseline — suites legitimately mutate shared fixtures, and per-suite
  restore proved order-fragile. For fast single-file iteration against existing
  state: `SKIP_DB_RESET=1 npx vitest run <file>`. Integration files run
  single-threaded (one shared DB).
- **Playwright** (`npm run e2e`) drives the two launch-critical paths:
  the timed check-in flow (SC-002) and steer attribution (SC-006). Projects:
  `chromium` (desktop) and `slow3g` (3G-class profile, throttled per-test via
  CDP). The web server env is auto-derived from `supabase status -o env`.

## What remains mocked / deferred

- **Wallet passes** — PassKit / Google Wallet issuance sits behind the
  `lib/pass.js` `PassIssuer` adapter, gated by the pre-launch A/B flag (R5/P7).
  The web passport is the complete fallback and is what all scenarios exercise.
- **Stripe** — all billing runs in Stripe test mode with the `4242` test card;
  price ids fall back to local placeholders when the `STRIPE_PRICE_*` secrets
  are unset.
- **OTP / mail delivery** — without `TWILIO_*` / `RESEND_API_KEY`, the
  claim-passport OTP and weekly-note mail use the fail-closed dev paths
  (`EXPOSE_DEV_OTP` / `EXPOSE_DEV_MAIL`), which only short-circuit in an
  explicitly non-production environment.
- **`src/data.js`** — the original mock seam is being deleted as each screen is
  wired to `lib/api.js` (T064); do not import it into newly wired screens.
