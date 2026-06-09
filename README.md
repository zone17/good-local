# Good Local — The Upper Delaware Passport

A regional loyalty + discovery passport for the independent businesses of the
Upper Delaware river region (NY/PA). Patrons scan a rotating QR at the register
to earn a stamp; visits build toward a business's perk and toward season-long
progress across the region's 12 towns. No app to download — the passport lives
in the phone's wallet. Businesses pay a flat **$79/mo** for a standalone rewards
program that compounds into a regional network.

**Live:** https://good-local.vercel.app

> Season one is a **pre-registered experiment** — its gates, thresholds, and
> kill condition are binding (see `.specify/memory/constitution.md` Art. III and
> `DECISIONS.md` D-007).

## Surfaces

| Path | Who | What |
|------|-----|------|
| `/` | Patron (mobile web) | Passport home, discovery, check-in explainer, profile |
| `/c/{slug}?k={code}` | Patron | The lean scan-landing the register QR encodes — earns the stamp |
| `/business` | Owner | Calm dashboard: weekly note, stats, perks, regulars, QR kit, redemption |
| `/business/signup` | Owner | Self-serve onboarding → Stripe → pending approval |
| `/admin` | Internal | Approvals, founding-pick curation, code rotation, the gate dashboard |

## Stack

- **Frontend** — Vite + React (two entries: the main SPA and a lean ≤60 KB
  check-in bundle), consuming the canonical design system in `design/`.
- **Backend** — Supabase (Postgres 15, RLS, Auth, Edge Functions/Deno, pg_cron).
  Every hard invariant is enforced mechanically: the check-in trust model is a
  single Postgres transaction, the patron privacy boundary is row-level
  security, gate metrics are versioned SQL views, and billing is Stripe
  subscriptions (card data never touches us).
- **Hosting** — Vercel (frontend) + hosted Supabase. CD: every merge to `main`
  auto-deploys to production.

## Repository layout

```
app/        Frontend (Vite + React) — patron, business, admin surfaces + lean check-in entry
design/     Canonical design system (tokens, components) — surfaces consume, never fork
supabase/   migrations/ (numbered SQL: schema → RLS → views → RPCs), functions/ (Deno), seed/
tests/      contract/ (RPC + view schemas), integration/ (RLS + trust-model), e2e/ (Playwright)
specs/      Spec-Kit artifacts — spec, plan, data-model, contracts, tasks, quickstart
docs/       Discovery brief, PR/FAQ, runbooks, and compounded solution write-ups
DECISIONS.md  Architectural decision log (D-001…) — the binding record of why
```

## Local development

Prerequisites: Node 22, Docker (for the Supabase local stack), and the
[Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
# 1. Frontend deps
cd app && npm install && cd ..

# 2. Test/tooling deps
npm install

# 3. Start the local Supabase stack (applies migrations + seed)
supabase start
supabase db reset            # migrations + seed (demo business "The Heron")

# 4. Run the app (set app/.env.local from app/.env.example first)
cd app && npm run dev        # → http://localhost:5173  (/c/* is rewritten to the check-in entry)
```

`app/.env.local` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
(`supabase status` prints them for the local stack). See `app/.env.example`.

## Tests

```bash
# Export the local stack keys first:  eval "$(supabase status -o env | tr -d '\"')"
npm test                 # vitest: contract + integration (RLS, trust model, gates)
npm run e2e              # Playwright: check-in flow, steer attribution, a11y
```

CI (`.github/workflows/ci.yml`) runs all of the above plus the bundle-size
budget (check-in ≤60 KB gz, main ≤130 KB gz), the brand gate, and typecheck on
every push.

## Deployment

- **Frontend** auto-deploys to Vercel on merge to `main` (root `vercel.json`
  builds `app/` and rewrites `/c/:path*` → the check-in entry, with an SPA
  fallback to `index.html`).
- **Backend** changes ship via the Supabase CLI: `supabase db push` (migrations),
  `supabase functions deploy`, `supabase config push` (auth/config).

See `docs/runbooks/season-one-ops.md` for the operational procedures (rotation,
suspension/restore, gate-read procedure, reprint flow).

## How it's built

Spec-Kit drives delivery (constitution → spec → plan → tasks → implement). The
guiding invariants live in `.specify/memory/constitution.md`; every non-obvious
decision is recorded in `DECISIONS.md`, and reusable learnings in
`docs/solutions/`.
