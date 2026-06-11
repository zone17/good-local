# Tasks: Launch Readiness Hardening

**Input**: Design documents from `/specs/002-launch-hardening/`

**Prerequisites**: spec.md (done). plan.md is pending; these tasks are generated from the spec plus
the audit (`docs/audits/production-readiness-2026-06-11.md`), whose findings carry exact file:line
evidence and recommended fixes — it serves as Phase-0 research. Tool choices marked (op) are
operator/console actions; everything else is repo work.

**Tests**: Included — this feature exists because untested paths shipped bugs (TEST-001/002).

**Organization**: Grouped by user story; stories are independently shippable after Phase 2.

## Phase 1: Setup (operator provisioning + rotations)

- [ ] T001 (op) Verify hosted Supabase plan tier; upgrade to Pro if free; enable/verify daily backups + PITR; record tier/retention in `docs/HANDOFF.md` §4 (DB-001a, INFRA-003)
- [ ] T002 [P] (op) Rotate the exposed Stripe test key + Cloudflare API tokens; remove the "pending rotation" admissions from `docs/HANDOFF.md` (INFRA-002, COMP-010)
- [ ] T003 [P] (op) Provision free-tier accounts: error tracking (Sentry) + uptime (Better Stack/UptimeRobot); store DSN/tokens per secret conventions (never in repo)

## Phase 2: Foundational (blocks all stories)

- [ ] T004 ErrorBoundary component (branded fallback + reload) wrapping routes in `app/src/App.jsx`; render guard in `app/src/checkin/main.jsx`; reload-once-on-chunk-load-failure wrapper for the eight `React.lazy` imports; delete the undefined `PERKS`/`BUSINESS` fallbacks in `app/src/business/BusinessApp.jsx:397,731` (ERR-001/002/018/019)
- [ ] T005 Fix the client error seam: `toApiError` in `app/src/lib/errors.js` maps message-carried §7 codes; `edge()` in `app/src/lib/api.js` parses `FunctionsHttpError.context`; never render raw `err.message` (sweep the six `BusinessApp.jsx`/`RegisterKit.jsx`/`Signup.jsx` fallbacks); contract test round-tripping one RPC raise + one edge non-2xx (API-001, ERR-014)
- [ ] T006 `vercel.json` headers block: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` + `Cache-Control: public, max-age=31536000, immutable` on `/assets/(.*)` (SEC-001, PERF-015)
- [ ] T007 Migration 0018: indexes `perk_redemptions(patron_id, perk_id, redeemed_at desc)`, `perk_redemptions(business_id)`, partial `stamps(patron_id, business_id)`, `staff_entries(business_id, local_date)`, `patron_devices(patron_id)`; `revoke delete` on `perk_redemptions`/`steer_impressions`; pg_cron purge of `otp_codes` older than 30 days (PERF-001..004, DB-009, DB-002b, COMP-006a)

**Checkpoint**: safety net + perimeter + seam in place; stories can proceed in parallel

## Phase 3: User Story 1 — Operator detects and survives failures (P1) 🎯 MVP

- [ ] T008 [US1] (op+repo) Restore drill: restore latest backup to a scratch project, verify row counts on `stamps`/`gate_metric_snapshots`; write `docs/runbooks/disaster-recovery.md` (restore steps, RPO/RTO statement, conninfo-rotation procedure, `NOTIFY pgrst` post-push step) (DB-001b, DB-003, DOC-005/009)
- [ ] T009 [P] [US1] Sentry: `@sentry/react` init in `app/src/main.jsx` + boundary integration (T004) + capture in the api seam; shared `logEvent` helper in `supabase/functions/_shared/` so every edge-function catch logs structured JSON before responding (OBS-001/006, ERR-020)
- [ ] T010 [P] [US1] (op) Uptime monitors: goodlocal.app 200+keyword, Supabase REST base, one anon read RPC probe; mobile push alert routing (OBS-003/009)
- [ ] T011 [P] [US1] Deadman workflow `.github/workflows/deadman.yml` (daily cron): fail loudly when today's `gate_metric_snapshots` rows missing, `cron.job_run_details` has failures, or any active business's current code exceeds `interval_days + 1` (OBS-002, DB-004)
- [ ] T012 [P] [US1] (op) Enable Vercel Web Analytics + Speed Insights (OBS-004/010)
- [ ] T013 [US1] Stripe webhook: `console.error` with event id/type before the 500; (op) enable Stripe webhook-failure email notifications (OBS-007)

**Checkpoint**: induced-failure drills pass per SC-001/SC-002

## Phase 4: User Story 2 — Legal and honest surfaces (P2)

- [ ] T014 [US2] `/privacy` + `/terms` static marketing routes + footer links in `app/src/marketing/Chrome.jsx` (content: data collected, processors, retention, deletion contact, SMS terms, no-sale affirmation; business terms: billing, cancellation, founding lock, no-cash-value stamps, 13+/16+ clause) (COMP-001/002/013)
- [ ] T015 [US2] SMS consent line + privacy link under both phone inputs (`app/src/checkin/main.jsx` ClaimSheet, `app/src/business/StaffCheckIn.jsx`); migration adds `patrons.sms_consent_at` + `consent_source`, recorded on claim (COMP-003)
- [ ] T016 [US2] Terms acknowledgment in `app/src/business/Signup.jsx` before checkout (FR-008)
- [ ] T017 [US2] `claim-passport`: no-provider path returns explicit 503-style error (client copy: "Claiming by text is temporarily unavailable"); log line drops the code and masks the phone (ERR-009, COMP-004)
- [ ] T018 [US2] Honest copy pass: wallet CTA → "Save my passport" (`checkin/main.jsx:294,371`), purge wallet promises from `Landing.jsx:103`, `RegisterKit.jsx:130` default instructions, `checkin.html` meta; fix "Claim link sent" (`StaffCheckIn.jsx:117`, `PatronApp.jsx:340`); delete the fake privacy card + `dan@theheron.co` (`BusinessApp.jsx:818-826`); align same-day copy (`Landing.jsx:53,143`) (UX-003/020/027, COMP-007/008)
- [ ] T019 [US2] DSR procedure: `docs/runbooks/` section (anonymize identifiers, scrub `staff_entries.patron_phone`, delete `otp_codes` rows, keep audit facts) + admin export query/RPC; retention policy table per data class (COMP-005/006, DB-005)

**Checkpoint**: every collection/promise surface verifiable per SC-003/SC-004

## Phase 5: User Story 3 — Check-in survives weak signal (P3)

- [ ] T020 [US3] `AbortSignal.timeout` on all checkin fetches (`app/src/checkin/checkin-api.js:68,80,94,135`) + guard the unguarded `res.json()` at `:85`; "Try again" control on transient error screens re-invoking `recordCheckIn` (safe: server dedups via DAILY_LIMIT); offline copy when `!navigator.onLine` (ERR-003/004/017, UX-001/002)
- [ ] T021 [US3] Passport error ≠ empty: consume `error`/`reload` from `usePassport` in `app/src/patron/PatronApp.jsx` ("your stamps are safe" + retry); same pattern for business-detail infinite-loading and silent discover errors (ERR-005/006/007, UX-009/011)
- [ ] T022 [US3] OTP flow: map `RATE_LIMITED` to wait guidance, add resend with 30s cooldown, `autocomplete="tel"`/`"one-time-code"` + form-wrap StaffCheckIn (ERR-008, UX-005/006/021)
- [ ] T023 [P] [US3] e2e failure-state specs: CODE_INVALID/CODE_RETIRED/BUSINESS_SUSPENDED render + retry behavior; implement real CDP 3G throttling in the slow3g project or delete it (TEST-004/010)

**Checkpoint**: SC-005 simulated-stall test passes

## Phase 6: User Story 4 — Revenue path correctness (P4)

- [ ] T024 [US4] Checkout idempotency in `supabase/functions/create-checkout-session/core.ts`: persist `idempotency_key`, return original outcome on re-submission, clean up (or reuse) the pending row on Stripe failure; handle `?canceled=1` return in `Signup.jsx`; on already-registered retry fall back to `signInWithPassword` (ERR-010/022, API-002, UX-018)
- [ ] T025 [US4] `update-subscription-plan/core.ts`: treat `!itemsResp.ok` and missing `itemId` as `STRIPE_ERROR` (ERR-011)
- [ ] T026 [US4] `shareWeeklyNote` in `app/src/lib/api.js:285` → invoke the `share-weekly-note` edge function; update contract §3.8 (ERR-012, API-003)
- [ ] T027 [US4] Pending/suspended branch in the `BusinessApp.jsx` shell from the `status` already returned by `useBusiness.js:37` — explicit in-review screen with "what you can do now" (UX-016)
- [ ] T028 [US4] Password recovery: reset-email flow + recovery route for owners/admin (`OwnerSignIn.jsx`, `AdminRoute.jsx`) (UX-017)
- [ ] T029 [P] [US4] Tests: contract tests for both billing cores (stub Stripe client, assert DB side effects — mirror the `stripe-webhook-core` pattern); unit tests for `otp-core.ts` incl. `devOtpAllowed` fail-closed matrix; expired-OTP + `staff_check_in` error paths (TEST-001/002/008)

**Checkpoint**: induced-failure walk of signup→pay→approve→switch→share shows zero false successes (SC-004/SC-007)

## Phase 7: User Story 5 — Releases can't silently degrade production (P5)

- [ ] T030 [US5] (op) Branch ruleset on `main`: require PR + the 5 existing status checks (frontend, tests, typecheck, e2e, brand); self-merge allowed (CICD-001)
- [ ] T031 [US5] `.github/workflows/deploy-db.yml` on push to main path-filtered to `supabase/**`: `supabase db push` (CLI pinned 2.105.0) → `NOTIFY pgrst, 'reload schema'` → `supabase functions deploy`; needs `SUPABASE_ACCESS_TOKEN` + DB password as Actions secrets — pin all actions to SHAs in the same PR (CICD-002/012)
- [ ] T032 [P] [US5] Security automation: `dependabot.yml` (npm root+app, github-actions), `npm audit --omit=dev --audit-level=high` CI job, CodeQL default setup, gitleaks job, (op) enable GitHub push protection (CICD-003, INFRA-006)
- [ ] T033 [US5] SMS-pumping gate (MUST precede Twilio enablement): Turnstile/CAPTCHA on the OTP send path, per-IP + global hourly send budget in `claim-passport`, CORS allowlist replacing `*` on the four interactive edge functions; region_interest: unique `(lower(email), region)` + throttle (SEC-002/004/005, API-004/005/011/014)
- [ ] T034 [P] [US5] Pipeline hygiene: `npm ci` in `vercel.json`, CI `concurrency` block + branch filter, Playwright `retries: 2` in CI, commit SHA exposed via `__COMMIT__` define (CICD-008/009/010/011)
- [ ] T035 [P] [US5] Post-deploy smoke: 2-test Playwright project against production (`GL_APP_URL` already supported) on `deployment_status` or schedule (CICD-006)

## Phase 8: Polish & docs

- [ ] T036 [P] Docs sweep: LICENSE (all-rights-reserved notice), README live URL fix, `supabase/functions/.env.example`, resolution banners on `todos/review-*.md`, HANDOFF Postgres 17 fix, Node version alignment (DOC-001/002/003/008/010, TEST-011, INFRA-014)
- [ ] T037 [P] ESLint flat config + `react-hooks` plugin over `app/src` + CI job; fix the two `const URL` shadowings and the suppressed dep array (CQ-001/003/013, CICD-007)
- [ ] T038 Coverage tooling: `@vitest/coverage-v8` + CI report (TEST-005)
- [ ] T039 Update `docs/audits/production-readiness-2026-06-11.md`: mark each P0/P1 closed or deferred-with-rationale (SC-009); run `/workflows:compound` on novel learnings

## Dependencies & Execution Order

- Phase 1 (operator) and Phase 2 (repo) can run in parallel; both block the stories they feed (T001 → T008; T004/T005 → US3/US4 messaging tasks).
- Sequencing gates encoded in the spec: T014–T017 + T033 MUST complete before Twilio enablement; T014/T016 before Stripe live keys.
- T031 adds deploy secrets to Actions — do T032's SHA pinning and push protection in or before that PR.
- Cross-spec: analytics (T012) is consumed by `003-marketing-discoverability` SC-008.

## Implementation strategy

MVP = Phases 1+2+3 (the operator can see failures and data survives) → US2 (legal gate for Twilio/Stripe) → US3 → US4 → US5 → Polish. Every checkpoint is independently deployable; nothing here changes product scope — it makes the existing promises true.
