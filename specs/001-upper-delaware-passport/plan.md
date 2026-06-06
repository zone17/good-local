# Implementation Plan: Good Local — Season One, The Upper Delaware Passport

**Branch**: `001-upper-delaware-passport` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-upper-delaware-passport/spec.md`

## Summary

Build the season-one product on three surfaces (patron mobile web ≤560px, business dashboard
≤1320px, internal admin) against a **Postgres-centered managed backend (Supabase)** where the
constitution's hard invariants are enforced mechanically: the check-in trust model as a
server-side transaction (rotating codes + per-day rate limit + dual attribution), the patron
privacy boundary as row-level security, gate metrics as versioned SQL views, and business billing
via Stripe subscriptions (card data never touches us). The existing `app/` Vite+React vertical
slice is promoted to the production frontend by swapping its single mock-data seam
(`app/src/data.js`) for a typed API client; `design/` remains the canonical visual source.
Wallet-pass issuance sits behind a thin adapter pending the pre-launch A/B (04/P7).

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + edge functions); SQL (Postgres 15) for schema,
policies, and gate-metric views

**Primary Dependencies**: Frontend: React 18 + react-dom + `@supabase/supabase-js` (3 runtime
deps — one over the vertical slice's standard, justified in research R1). Backend: Supabase
platform (Postgres, Auth, RLS, Edge Functions/Deno, pg_cron), Stripe (Billing/Checkout/webhooks)

**Storage**: Postgres (Supabase-managed) — single database, region-scoped schema per spec
FR-035; all invariants as constraints/policies/views in versioned migrations

**Testing**: Vitest (unit + contract tests against RPC/view schemas), Supabase local stack for
integration (RLS policy tests run as three roles: patron/owner/admin), Playwright for the two
launch-critical E2E paths (check-in flow SC-002; steer-attribution SC-006)

**Target Platform**: Mobile web (iOS Safari 16+, Android Chrome) for patrons; desktop/tablet web
for owners and admin; print (US Letter) for the QR kit

**Project Type**: Web application — SPA frontend + managed backend (no custom server process)

**Performance Goals**: Patron check-in entry ≤60KB gzipped JS, interactive <3s on 3G-class
(SC-008); check-in RPC round-trip <500ms p95; returning check-in flow <10s end-to-end (SC-002)

**Constraints**: WCAG AA + tap-target floors (Art. IX); no card data in our systems; deterministic
enforcement of Articles I/II/V/VI (no LLM in any invariant path); offline-tolerant check-in
confirmation (durable server record even if confirmation UI fails)

**Scale/Scope**: Season one: ~25 businesses, ~500–2,000 patrons, ~10k check-ins, 1 region,
3 surfaces, ~12 DB entities — deliberately small; schema leaves room without building for scale

## Constitution Check

*GATE: evaluated against `.specify/memory/constitution.md` v1.0.0 — pre-Phase-0 and re-checked
post-Phase-1.*

| Article | Gate | Plan compliance |
|---|---|---|
| I — Trust Is the Product | No paid placement/ratings/fabricated counts anywhere | Discovery ordering = curated picks + true counters from SQL views; no ranking code path exists; counters render only real aggregates (data-model: `verified_regulars` view) |
| II — Check-In Is Sacred | Two attribution paths; server-side validation; rate limit; corrections preserve history | `record_check_in` is a single Postgres transaction (token validation + uniqueness + insert); staff path writes `staff_entries`; DB CHECK forbids stamps without attribution; voids are status flips, never deletes |
| III — Pre-Registered Experiment | Gates computable day one; thresholds immutable in code | Metric definitions are versioned SQL views in migrations; thresholds live in a `gate_thresholds` table seeded from the brief, changes require migration (reviewable) |
| IV — Standalone-First | No feature requires density | All business-scoped features read only business-scoped data; network features (region card, discovery) render gracefully at n=1 |
| V — Privacy Boundary | Owner can never see cross-business patron activity | **RLS policies** scope owner reads to their business's rows; aggregates exposed only via owner-scoped views; integration tests assert the boundary as the owner role |
| VI — No Monetary Value | Nothing introduces cash value | No price/value/currency columns on stamps or perks beyond perk descriptions; Stripe touches subscriptions only |
| VII — Seasonal Honesty | No streaks/time-decay | No decay jobs exist; season scoping via `seasons` table config |
| VIII — Canonical Design | Surfaces consume `design/` | `app/` already imports tokens/components from `design/` via the `@ds` alias; plan adds no styling forks |
| IX — Riverbank | AA, tap targets, 3G budget | Separate tiny Vite entry for `/c/` check-in route; perf budget in CI (size-limit check); AA verified in E2E |
| X/XI — API-first, parity | Every action a structured capability | All mutations are named Postgres RPCs / edge functions (contracts/); UI and admin both call them; nothing UI-only |
| XII — Deterministic Shell | No LLM in invariant paths | v1 has zero LLM components (weekly note is template-composed from real aggregates; LLM phrasing is future scope behind Art. XXIV evals) |
| XVI — Region-Scoped | Region as data, no multi-region infra | `region_id` on scoped tables; exactly one row seeded; no routing/sharding infrastructure |
| XXVIII — Simplicity | Smallest architecture preserving options | No custom server, no queues, no microservices; one managed Postgres + 3 edge functions; frontend gains exactly one dependency |
| XXIII — Branch discipline / XXXI hooks | — | Work on `001-upper-delaware-passport`; repo hooks active |

**Pre-Phase-0 result**: PASS — no violations, Complexity Tracking empty.
**Post-Phase-1 re-check (2026-06-06)**: PASS — design artifacts introduce no new dependencies or
surfaces beyond the above; RLS test matrix in quickstart.md covers Art. V; contracts expose no
UI-only capability.

## Project Structure

### Documentation (this feature)

```text
specs/001-upper-delaware-passport/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions R1–R8
├── data-model.md        # Phase 1 output — schema, RLS, views, transitions
├── quickstart.md        # Phase 1 output — run + validation scenarios
├── contracts/           # Phase 1 output
│   └── api.md           # Domain verbs: RPCs, edge functions, views
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
app/                          # Frontend (existing vertical slice → production)
├── index.html                # patron/business/admin SPA entry
├── checkin.html              # NEW: minimal /c/ entry (3G budget, Art. IX)
├── src/
│   ├── ds.js                 # design-system barrel (unchanged)
│   ├── data.js               # REPLACED by lib/api.ts (same shapes — the seam holds)
│   ├── lib/
│   │   ├── api.ts            # typed client: RPC calls, view reads (contracts/api.md)
│   │   ├── auth.ts           # patron anonymous+OTP, owner email, admin role
│   │   └── pass.ts           # PassIssuer adapter (A/B-deferred impl behind interface)
│   ├── patron/               # PatronApp + screens (existing, wired to api.ts)
│   ├── business/             # BusinessApp + screens (existing, wired) + staff check-in
│   ├── admin/                # NEW: approvals, picks curation, rotation, gate dashboard
│   └── checkin/              # NEW: the tiny scan-landing flow (own entry)
supabase/
├── migrations/               # numbered SQL: schema → constraints → RLS → views → seeds
├── functions/                # edge functions (Deno/TS)
│   ├── record-check-in/      # token validation + stamp transaction wrapper
│   ├── stripe-webhook/       # subscription lifecycle → subscriptions table
│   └── claim-passport/       # one-time link from staff phone entry
└── seed/                     # region, towns, gate_thresholds, demo business
design/                       # canonical design system (consume-only)
tests/
├── contract/                 # RPC/view schema contract tests (Vitest)
├── integration/              # RLS role-matrix + trust-model tests (Supabase local)
└── e2e/                      # Playwright: check-in path, steer attribution
```

**Structure Decision**: Extend the existing two top-level code roots (`app/`, new `supabase/`)
rather than introducing `backend/` — there is no custom server process to house. The mock seam
`app/src/data.js` is replaced by `app/src/lib/api.ts` exposing the same data shapes, so screen
code churn is minimal and the design-system import path is untouched.

## Phase 0 — Research

Unknowns extracted from Technical Context and resolved in [research.md](research.md):

- R1 Backend platform (custom server vs Supabase vs full-stack framework)
- R2 Rotating-code scheme compatible with printed kits
- R3 Patron identity with no-password, multi-device, staff-claim constraints
- R4 Stripe subscription pattern for founding lock + winter tier
- R5 Wallet-pass issuance options behind the A/B (Apple/Google, build vs service)
- R6 Gate-metric definitions as deterministic SQL
- R7 3G performance budget mechanics (entry splitting, font strategy)
- R8 Steer-impression capture without heavy analytics

## Phase 1 — Design & Contracts

Outputs generated alongside this plan:

- [data-model.md](data-model.md) — 12 tables + 6 views, constraints, RLS policy matrix, state
  transitions (business status, code lifecycle, perk lifecycle, subscription states)
- [contracts/api.md](contracts/api.md) — the domain verbs (Art. XIII): patron RPCs
  (`record_check_in`, `claim_passport`, `link_device`), owner RPCs (`publish_perk`,
  `redeem_perk`, `staff_check_in`, profile/kit ops), admin RPCs (`approve_business`,
  `curate_pick`, `rotate_code`, `read_gate_metrics`), views consumed read-only, Stripe webhook
  events handled, and structured error codes
- [quickstart.md](quickstart.md) — local run (Supabase local + Vite), seeded demo path, and the
  validation scenarios mapped to SC-001…SC-010 (including the RLS role-matrix proof for Art. V)
- Agent context — `CLAUDE.md` SPECKIT block updated to reference this plan

## Phase 2 — Planning approach (executed by /speckit-tasks, not here)

Tasks will be generated from the user stories in priority order (US1 business onboarding →
US2 check-in → …), each carrying its contract tests first (Art. XIX), with the trust-model and
gate-instrumentation work marked launch-blocking, and the June 18 vertical-slice gate mapped to
the end of the US2 task group.

## Complexity Tracking

> Constitution Check passed pre-Phase-0 and post-Phase-1 — no violations to justify.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
