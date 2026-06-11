# Production Readiness Audit — Good Local

**Project:** Good Local — The Upper Delaware Passport (LIVE at https://goodlocal.app)
**Date:** 2026-06-11
**Auditor:** Claude Production Readiness Audit v1 — 14 parallel domain agents (12 standard + SEO/copy + usability), findings deduplicated and synthesized
**Tech stack:** Vite 6 + React 18 SPA (two entries, no SSR) / Supabase Postgres + RLS + Auth + 5 Deno edge functions / Stripe (TEST mode) / Vercel CD + Cloudflare DNS / Vitest + Playwright / GitHub Actions

---

## Executive summary

**Overall readiness: RED** — driven by three P0s and three RED domains. The core product engineering is genuinely strong (complete RLS coverage, hardened OTP/webhook paths, disciplined contract-first RPCs, real CI gates, honest brand voice). The gaps cluster in everything *around* the code: zero runtime telemetry, an absent legal surface on a live PII-collecting app, a marketing site invisible to crawlers and social scrapers, no verified backups, and a set of silent false-success bugs on money and identity flows.

| Metric | Value |
|---|---|
| Raw findings (14 agents) | 228 |
| Unique after dedup | ~200 |
| **P0 (launch blockers)** | **3** |
| P1 (must fix before launch) | ~45 unique |
| P2 (fix soon) | ~75 |
| P3 (nice to have) | ~75 |
| Estimated P0+P1 effort | ~18–25 engineer-days (quick-win wave covers ~half of P1s in ~3–4 days) |

### The three P0s

1. **DB-001 — Backups/PITR unverified, restore never tested.** Plan tier of the hosted Supabase project is unknown; if free tier, there are **no automated backups at all** for a live append-only audit system whose binding experiment reads (Aug 15 / Nov 1) are unrecoverable by design. *Verify tier today; upgrade to Pro; run one restore drill.* (Effort: S)
2. **ERR-001 — No React error boundary anywhere.** Any render error or stale-deploy chunk failure unmounts the whole SPA to a permanent white screen — invisible to the operator (no error tracking either). (Effort: S)
3. **COMP-001 — No privacy policy exists** on a live consumer app collecting phone numbers, emails, and location-linked visit history. Also a hard prerequisite for Twilio A2P 10DLC registration and a bad look for the trust-first brand. (Effort: S)

### Domain readiness heatmap

| Domain | Status | P0 | P1 | Top risk |
|---|---|---|---|---|
| Observability | 🔴 RED | 0 | 4 | Zero telemetry; silent pg_cron failure can void the season-one experiment |
| Error handling | 🔴 RED | 1 | 9 | White-screen class + silent false-success on money/identity flows |
| Compliance | 🔴 RED | 1 | 4 | No privacy policy/ToS/SMS consent; live OTPs in production logs |
| SEO & copy | 🔴 RED | 0 | 3 | Crawlers and Facebook scraper get an empty shell; no OG/sitemap/titles |
| Security | 🟡 YELLOW | 0 | 3 | No CSP/headers; SMS-pumping vector activates when Twilio lands |
| Testing | 🟡 YELLOW | 0 | 3 | Money path (checkout/plan switch) and entire frontend untested |
| CI/CD | 🟡 YELLOW | 0 | 3 | main unprotected; Vercel deploys in parallel with CI; manual DB deploys |
| Database | 🟡 YELLOW | 1 | 1 | (P0 above); plaintext OTP retention; conninfo rotation trap |
| API design | 🟡 YELLOW | 0 | 4 | Client seam collapses every error code to VALIDATION |
| Infrastructure | 🟡 YELLOW | 0 | 3 | No staging; pending credential rotations; bus factor 1 |
| Performance | 🟡 YELLOW | 0 | 3 | No immutable cache headers; missing hot-path indexes |
| Documentation | 🟡 YELLOW | 0 | 4 | No LICENSE; contract stale by 3 migrations; no DR runbook |
| Code quality | 🟡 YELLOW | 0 | 3 | No ESLint; zero type coverage on app source; god components |
| UX | 🟡 YELLOW | 0 | 7 | Wallet promise not kept (incl. printed cards); owner funnel limbo |

### Critical path to launch-ready (dependency order)

1. **Verify Supabase tier; enable backups/PITR; one restore drill** (DB-001, INFRA-003) — everything else assumes the data survives.
2. **Rotate the exposed Stripe test key + Cloudflare tokens** (INFRA-002/COMP-010) — precondition for live keys.
3. **Ship /privacy + /terms + SMS consent lines** (COMP-001/002/003) — gates Twilio A2P and Stripe live mode.
4. **OTP hygiene:** gate the plaintext OTP log line, return explicit error when no SMS provider, pg_cron purge of expired codes, hash codes at rest (COMP-004, ERR-009, DB-002).
5. **SMS-pumping gate before Twilio:** CAPTCHA/Turnstile + per-IP/global send budget + CORS allowlist (SEC-002, API-004, SEC-005).
6. **Runtime safety net:** error boundary, chunk-reload recovery, check-in timeout + retry, passport error≠empty (ERR-001/002/003/004/005).
7. **Telemetry:** Sentry (app+functions), uptime monitors, pg_cron deadman workflow, Vercel analytics + Speed Insights (OBS-001..004, OBS-002 is the experiment-saving one).
8. **Fix the client error seam** so §7 codes reach the UI (API-001), then the false-success bugs: winter-tier swap, weekly-note share, checkout idempotency/orphan cleanup (ERR-011, ERR-012/API-003, ERR-010/API-002).
9. **Pipeline gates:** branch ruleset on main requiring the 5 checks; deploy-db workflow with `NOTIFY pgrst`; Dependabot + CodeQL + gitleaks; `npm ci` on Vercel (CICD-001/002/003/009).
10. **Perimeter:** security headers/CSP in vercel.json; immutable cache headers; hot-path indexes migration (SEC-001, PERF-015, PERF-001/002/003).
11. **Honesty pass:** wallet CTA rename + purge "wallet" promises (incl. RegisterKit default copy), delete fake privacy toggles + mock email, fix "Claim link sent", align "same day" copy (UX-003, UX-027/COMP-007, COMP-008, UX-020).
12. **SEO foundation before the launch content push:** robots.txt, sitemap, default OG image + tags, per-route meta hook, canonical, real 404, Organization JSON-LD; then prerender/edge-meta for marketing routes (SEO-001..008).
13. **Stripe live cutover** (existing HANDOFF step 1) — only after 2, 3, and 8.

### Quick wins (≈3–4 days total, disproportionate impact)

| Fix | Closes | Effort |
|---|---|---|
| Branch ruleset on main requiring existing 5 checks | CICD-001 | XS |
| Uptime monitors (Better Stack/UptimeRobot free) on / + Supabase REST | OBS-003 | XS |
| @sentry/react + ErrorBoundary + capture in trace seam | OBS-001/005, ERR-001 | S |
| Scheduled GH Action: snapshot freshness + cron.job_run_details + rotation staleness | OBS-002, DB-004 | S |
| Vercel Web Analytics + Speed Insights toggles | OBS-004, OBS-010 | XS |
| vercel.json headers block: CSP/XFO/nosniff/Referrer-Policy + immutable cache on /assets | SEC-001, PERF-015 | S |
| Migration 0018: 4 hot-path indexes + revoke delete on redemptions/impressions + otp purge job | PERF-001/002/003, DB-009, COMP-006 | S |
| toApiError maps message-carried codes; edge() parses FunctionsHttpError | API-001 | S |
| shareWeeklyNote → edge fn (one line) | ERR-012/API-003 | XS |
| Treat skipped Stripe price-swap as error | ERR-011 | XS |
| Gate OTP console.log; explicit 503 when no SMS provider | COMP-004, ERR-009 | XS |
| robots.txt + sitemap fn + default OG tags + og.png + Org JSON-LD | SEO-003/004/005/008 | S |
| usePageMeta hook (titles/descriptions/canonical/noindex) | SEO-002/007/016 | S |
| Wallet CTA rename + copy purge; delete fake privacy card; fix claim-link copy; align same-day copy | UX-003/027, COMP-007/008, UX-020 | S |
| autocomplete="tel"/"one-time-code"; StaffCheckIn form wrap; retry button on check-in errors | UX-005/021, ERR-004 | XS |
| ESLint flat config + react-hooks plugin + CI job | CQ-001 | S |
| LICENSE + README URL fix + functions/.env.example + resolution banners on old todos | DOC-001/002/003/008 | XS |
| Rotate Stripe test key + Cloudflare tokens | INFRA-002 | XS |
| npm ci on Vercel; CI concurrency; Playwright retries; pin actions to SHAs | CICD-009/010/011/012 | XS |

---

## Detailed findings — P0

### DB-001 · P0 · Backups/PITR unverified; restore never tested; no backup runbook
Zero backup/restore mentions across docs/runbooks/DECISIONS. Hosted project `vrzwrnpqfpsxlrbiyzem` is live; plan tier undocumented (INFRA-003). Free tier = no automated backups. The product's value is immutable history (`stamps`, `perk_redemptions`, `gate_metric_snapshots` — binding Aug 15/Nov 1 reads, no backfill possible). Forward-only migrations make backups the only rollback of last resort (DB-008). **Fix:** verify tier → Pro if needed → enable PITR → one restore drill to a scratch project → runbook section; optional nightly pg_dump via GH Action. *Effort S.*

### ERR-001 · P0 · No React error boundary — render/chunk errors are a permanent white screen
`app/src/App.jsx:65-71` Suspense with blank-div fallback, no boundary anywhere (grep-verified, both entries); no `window.onerror`/`unhandledrejection`. Compounded by ERR-002 (every deploy can orphan open sessions on hashed-chunk 404s) and latent crash paths (undefined `PERKS`/`BUSINESS` fallbacks, module-level env throw). **Fix:** ErrorBoundary wrapping routes + branded fallback + reload-once-on-chunk-failure; render guard in `checkin/main.jsx`. *Effort S.*

### COMP-001 · P0 · No privacy policy on a live app collecting phones, emails, visit history
No `/privacy` route, no footer legal links (router `App.jsx:26-63`, footer `Chrome.jsx:99-122`), confirmed live. Exposure: NY GBL §349, state privacy laws, Twilio A2P registration requires a privacy-policy URL, and the PR/FAQ's own trust claims are unbacked. **Fix:** static `/privacy` (data collected, purposes, processors: Supabase/Stripe/Vercel/Twilio/Resend/Google Fonts, retention, deletion contact, SMS terms, "we do not sell") linked from footer + both phone-entry points + signup + region form. *Effort S.*

---

## Detailed findings — P1 (unique, deduplicated)

**Observability (OBS) — domain RED**
- **OBS-001 (+SEC-003, ERR-020)** No frontend/edge error tracking; `trace.js` is a DEV-gated no-op with zero callers. Patron JS crashes silently suppress gate metrics. Fix: Sentry free tier, tag correlation ids. *S*
- **OBS-002 (+DB-004, INFRA-010)** pg_cron jobs (`rotation-sweep`, `gate-metric-snapshot`) can fail silently; snapshot gaps are permanently unrecoverable and the rotating-code trust control erodes invisibly. Fix: scheduled GH Action deadman (snapshot freshness, `cron.job_run_details`, code staleness) → red run = email alert. *S*
- **OBS-003** No uptime monitoring or alert routing; downtime discovered by business owners. Fix: free uptime service, 3 monitors, mobile push. *XS*
- **OBS-004** Zero web analytics; June 20 funnel (visit → signup → checkout) unmeasurable. Fix: Vercel Web Analytics now; event funnel later. *XS*

**Error handling (ERR) — domain RED**
- **ERR-002** No stale-deploy chunk-load recovery (classic Vercel SPA failure; CD ships on every merge). *S*
- **ERR-003/004 (+UX-001/002)** Check-in fetches have no timeout and error screens have no retry — the sacred path hangs forever or forces a physical re-scan on weak rural cellular (contradicts US2). Server-side stamp commit makes retry safe (DAILY_LIMIT dedup). *S*
- **ERR-005 (+UX-009)** Passport load failure renders the brand-new EMPTY state; a 12-stamp regular on flaky signal sees "No stamps yet" — perceived data loss. Hook already exposes `error`+`reload`; UI ignores both. *S*
- **ERR-008** OTP rate-limit/lockout misreported as "code didn't match — try again," deepening lockout; no resend affordance. *S*
- **ERR-009 (+COMP-004, OBS-012)** OTP send returns `{sent:true}` with no SMS provider configured (today's prod state) and logs plaintext phone + live code. Fix: explicit 503-style error + masked logging. *S*
- **ERR-010 (+API-002)** Checkout inserts the pending business before the Stripe call; transient failure strands an orphan row → every retry hits DUPLICATE_PENDING; `idempotency_key` is never honored DB-side. Revenue path. *M*
- **ERR-011** Winter-tier switch returns success when the Stripe price swap was skipped (`!itemsResp.ok`/missing `itemId` fall through) — owner believes $49, Stripe bills $79. *XS*
- **ERR-012 (+API-003)** "Share with co-owner" calls the record-only RPC; the email-sending edge fn has no caller. Silent total feature failure presented as "Sent." *XS*

**Compliance (COMP) — domain RED**
- **COMP-002** No Terms of Service — paid $79/mo subscriptions with no contract terms (refunds, founding-rate lock, suspension, no-cash-value stamps). Must land before Stripe live. *M*
- **COMP-003** No SMS/TCPA consent language at either phone-collection point; staff-entered path texts numbers their owners never typed anywhere; A2P campaign will be rejected without it. *S*
- **COMP-005** No data deletion/export path ("delete my data" has no answer; PRFAQ claims "your visit history is yours"). Fix: anonymize-not-delete DSR runbook + export RPC. *M*

**Security (SEC)**
- **SEC-001 (+INFRA-009)** No CSP/X-Frame-Options/nosniff/Referrer-Policy headers; `renderMarkdown` is the sole XSS barrier with no backstop; sessions in localStorage. Fix: vercel.json headers block. *S*
- **SEC-002 (+API-004)** Unauthenticated OTP send is per-phone limited only (5/hr/phone) — rotating numbers = unbounded aggregate SMS (toll fraud) the day Twilio creds land. Fix BEFORE Twilio: Turnstile + per-IP/global budget + CORS allowlist. *M*
- *(SEC verified strong: complete RLS coverage on all 31 tables, SECURITY DEFINER discipline, timing-safe webhook verification, OTP lockout w/ autonomous counter, 128-bit codes, clean secret hygiene in git history, 0 prod-dependency CVEs.)*

**CI/CD (CICD)**
- **CICD-001** `main` has no branch protection/rulesets (API-verified); Vercel deploys in parallel with CI, not after — red-CI code ships. Local hooks protect only one machine. *S*
- **CICD-002** DB migrations/functions/auth config deploy manually while the app auto-deploys; known `NOTIFY pgrst` footgun; D-024 proves the drift class already bit production. Fix: path-filtered deploy-db workflow. *M*
- **CICD-003 (+INFRA-006)** Zero security scanning (no Dependabot/CodeQL/npm audit/gitleaks/push protection) on a public repo with payment+auth code and a documented credential-leak history. *S*

**Testing (TEST)**
- **TEST-001** Billing edge functions (`create-checkout-session`, `update-subscription-plan`) have zero tests — the only uncovered contract verbs, and they touch revenue (ERR-010/011 prove the cost). *M*
- **TEST-002** `otp-core.ts` (incl. the fail-closed `devOtpAllowed` security flag) purpose-built for unit testing, untested. *XS*
- **TEST-003** ~5,700 LOC frontend, zero component/unit tests; only the check-in happy path has e2e. *M*

**API (API)**
- **API-001** The main client seam (`lib/errors.js` + `api.js edge()`) collapses every RPC/edge error code to `VALIDATION` — all code-keyed UI copy (staff limits, perk states, duplicate signup, winter window) never fires. The lean check-in entry maps correctly; copy the pattern. *S*

**Infrastructure (INFRA)**
- **INFRA-001 (+CICD-004)** No non-prod environment; Vercel previews crash (env vars are Production-only) so nothing rehearses hosted-config reality before prod. *M*
- **INFRA-002 (+COMP-010)** Exposed Stripe test key + Cloudflare tokens still pending rotation (publicly admitted in HANDOFF). Cloudflare token = DNS takeover vector. *XS*
- **INFRA-003** Supabase plan tier unknown/undocumented (free tier would mean pausing + no backups + tighter pools). *XS*

**Performance (PERF)**
- **PERF-001/002 (+DB-007)** Missing indexes on `perk_redemptions(patron_id, perk_id)` and partial `stamps(patron_id, business_id)` — `perk_progress_count` is on every check-in and dashboard load. *XS*
- **PERF-015** No immutable Cache-Control on hashed assets — repeat patrons re-download the check-in bundle on rural 3G. *XS*

**Documentation (DOC)**
- **DOC-001** No LICENSE (public repo). *XS* · **DOC-002** README live URL stale. *XS* · **DOC-003** No `supabase/functions/.env.example`. *XS* · **DOC-004 (+API-008)** Contract missing CMS/region-interest surface + 3 drifted verbs (staff_check_in params, OTP send leg, weekly-note carrier). *M*

**Code quality (CQ)**
- **CQ-001** No ESLint/Prettier anywhere. *S* · **CQ-002** Type checking covers tests only; all app source untyped. *L (incremental)* · **CQ-003** `const URL` shadows the global in two files. *XS*

**SEO (SEO) — domain RED**
- **SEO-001** Marketing routes serve an empty `<div id="root">` to all crawlers/scrapers (no SSR/prerender); blog bodies additionally need a runtime Supabase fetch. Fix path: meta hook now → build-time prerender (publish-webhook → deploy hook) or edge meta injection. *M*
- **SEO-002** One static title/description for every route; `document.title` never set. *XS (hook)*
- **SEO-003** No OG/Twitter tags, no share image — Facebook never executes JS; the primary distribution channel renders bare links. *XS default, S–M per-post*

**UX (UX)**
- **UX-003** Wallet promise broken in 4 places incl. the printed register card default copy — "Add to Apple Wallet" puts nothing in Apple Wallet (stub issuance). *S (copy now; real .pkpass is a feature)*
- **UX-016** Post-payment pending-approval state invisible on return visits — paid owners see a live-looking empty dashboard, may post QR before approval. *M*
- **UX-017** No password recovery for owners/admin ($79/mo lockout = manual support). *M*
- **UX-027 (+COMP-007)** Live Settings ships mock data: three no-op privacy toggles + hardcoded `dan@theheron.co`. *XS*

---

## P2/P3 backlog (condensed; full detail in agent transcripts)

**Security:** SEC-004/API-005/DB-012 region_interest anon-insert abuse guards (S) · SEC-005/API-011 CORS allowlist (XS) · SEC-006 seed.sql admin user must never reach hosted (S) · SEC-007 dev-toolchain CVEs (S).
**Testing:** TEST-004 3G throttling project is vacuous (S) · TEST-005 no coverage tooling (XS) · TEST-006 handcrafted Stripe fixtures (M) · TEST-007 rotation_sweep untested (S) · TEST-008/009 error-path + edge-case gaps (M) · TEST-010 e2e failure-state specs (S) · TEST-011/DB-006/INFRA-014 Postgres 17-vs-15 doc/config drift — verify hosted (XS) · TEST-012 load test (defer) · TEST-013 parallelism-dependent residuals (S).
**CI/CD:** CICD-004 staging decision (M) · CICD-005 rollback runbook + drill (S) · CICD-006 post-deploy smoke test (S) · CICD-007 lint+typecheck don't cover app source (S) · CICD-008 SHA in artifact (XS) · CICD-009 npm ci on Vercel (XS) · CICD-010 concurrency (XS) · CICD-011 CLI cache + Playwright retries (XS) · CICD-012 pin actions to SHAs before adding deploy secrets (XS).
**Observability:** OBS-005 boundary fallback (XS, rides ERR-001) · OBS-006 edge fns log nothing on handled failures; correlation id dead-ends (S) · OBS-007 webhook failure visibility + Stripe email notifications (XS) · OBS-008 RED metrics via Sentry (XS) · OBS-009 health RPC probe (S) · OBS-010 CWV RUM (XS) · OBS-011 log retention note (XS).
**Performance:** PERF-003/004 staff_entries + patron_devices indexes (XS) · PERF-005 get_dashboard O(N×M) perk_progress_count calls → CTE (M) · PERF-006 unbounded content reads, add .limit(50) (XS) · PERF-007 regulars unbounded (S) · PERF-008 gate view live-read cost (M, snapshots already mitigate) · PERF-009 dblink fresh connections on hot paths — verify pooled conninfo + timeout (S) · PERF-013 fonts: preconnect on checkin.html now, self-host later (S/M) · PERF-014 Supabase preconnect (S) · PERF-016 blog img dimensions (XS) · PERF-017 landing LCP client-rendered (rides SEO-001) · PERF-018 HTTP-level rate limit on record_check_in (S) · PERF-019 k6 smoke (S).
**Database:** DB-002 hash OTP codes at rest + purge (S–M) · DB-003 conninfo rotation trap + Vault/minimal role (M; runbook line XS now) · DB-005 phone retention policy (S) · DB-008 document forward-only strategy (S) · DB-009 revoke delete belt-and-braces (XS) · DB-010 two unlocked check-then-act races (XS) · DB-011 idempotency convention (XS) · DB-013 doubled-apostrophe literals (XS) · DB-014 partitioning trigger note (n/a).
**API:** API-005 region_interest throttle (S) · API-006 record_impressions bounds + region filter (XS) · API-007 versioning policy (S) · API-008 contract drift amendments (S) · API-009 pagination on regulars/audit/content (S) · API-010 timeouts client+edge (S) · API-012 status/code mismatches (XS) · API-013 document RPC-400 posture (XS) · API-014 pending-business cap (XS) · API-015 size-bound convention (XS).
**Infrastructure:** INFRA-004 rebuild-prod runbook + config push (M) · INFRA-005 DR posture/RPO-RTO (S) · INFRA-007 bus-factor credentials → password manager + emergency access (S) · INFRA-008 (=ERR-001/002) · INFRA-011 sk_test_local silent fallback → fail fast (XS) · INFRA-012 .vercel.app 308 + registrar docs (XS) · INFRA-013 cold-start note (XS).
**Error handling:** ERR-006/007/013 detail/discover/dashboard error branches (XS each) · ERR-014 raw err.message shown to owners (S) · ERR-015 retry wrapper for idempotent reads (M) · ERR-016 edge 5xx leaks detail/mislabeled VALIDATION (S) · ERR-017 unguarded res.json (XS) · ERR-018 undefined PERKS/BUSINESS fallbacks (XS) · ERR-019 env throw → boundary (XS) · ERR-021 sign-in network≠wrong-password (XS) · ERR-022 checkout cancel/return unhandled (S).
**Documentation:** DOC-005 infra incidents runbook §7 (S) · DOC-006 webhook replay + SMS/email failure procedures (M) · DOC-007 support workflow + help links (S) · DOC-008 resolution banners (XS) · DOC-009 DR plan (M) · DOC-010 Node version drift (XS) · DOC-012 CONTRIBUTING (XS) · DOC-013 CHANGELOG (S) · DOC-014 env-file path clarity (XS).
**Code quality:** CQ-004 split 884/723/649-line god files (M) · CQ-005 shared AppSidebar (S) · CQ-006 stale api.js header comment (XS) · CQ-007 dead trace.js/pass.js — wire or delete (XS–S) · CQ-008 dead linkDevice export (XS) · CQ-009 broken getRole owner path (XS) · CQ-010 devOtp display needs client-side DEV gate (XS) · CQ-011 StaffCheckIn bypasses @ds barrel (XS) · CQ-012 stale TODOs (XS) · CQ-013 dep-array suppression (XS) · CQ-014 React 19 migration (defer) · CQ-015 Vite 7/8 upgrade (defer) · CQ-016 ungated console.warn (XS) · CQ-018 unused qrcode dependency — remove (XS; contradicts D-014's rationale, reconcile in DECISIONS).
**Compliance:** COMP-006 retention policy + otp purge + dead patrons.email (S) · COMP-008 "Claim link sent" is false — no send path exists (S) · COMP-009 stored-value counsel memo still pending (M, external) · COMP-011 breach-notification runbook NY SHIELD (S) · COMP-012 Google Fonts IP disclosure or self-host (S) · COMP-013 13+/16+ clause (XS) · COMP-014 audit ledger gaps: curate_founding_pick + content writes unlogged (S) · COMP-015 "no paid placement" vs "launch-marketing placement" wording (XS).
**SEO:** SEO-004 sitemap (S) · SEO-005 robots.txt (XS) · SEO-006 soft-404s → real NotFound + noindex (S) · SEO-007 canonicals + .vercel.app redirect (S) · SEO-008 JSON-LD phases (XS→M) · SEO-009 landing copy carries no target-query language; H1 keyword-free (S) · SEO-010 content engine empty; no town/business/about/FAQ/pricing pages (L, each page S) · SEO-011 post URLs undiscoverable (rides 001/004) · SEO-012 three dash violations (Podcast.jsx:26, checkin.html title+meta) (XS) · SEO-013 E-E-A-T: about/contact/author (S) · SEO-014 copy nits: blog teaser mismatch, Admin footer link, trust band placement (XS) · SEO-015 renderMarkdown lacks lists/images (S) · SEO-016 noindex app surfaces (XS) · SEO-017 off-site: GBP, citations, podcast RSS (M, non-engineering).
**UX:** UX-005 autocomplete tel/one-time-code (XS) · UX-006 resend code w/ cooldown (S) · UX-007 name from slug (S) · UX-008 reduced-motion coverage (XS) · UX-010 dead chrome buttons (S) · UX-011 silent detail/discover errors (S) · UX-012 clickable Cards keyboard-inaccessible (S) · UX-013 no self-serve claim in /app (M) · UX-014 skeletons + URL state (M) · UX-015 check-in CTA mismatch (S) · UX-018 signup retry wedge (S) · UX-019 dead "Your name" field (XS) · UX-020 same-day copy (XS) · UX-021 StaffCheckIn form/Enter (XS) · UX-022 autofill leak (XS) · UX-023 staff path buried + over-privileged (M) · UX-024 mail-me stub alert (XS) · UX-025 admin footer link (XS) · UX-026 region form autocomplete (XS) · UX-028 dashboard loading vs sign-in (XS) · UX-030 window.prompt/confirm (M) · UX-031 modal dialog semantics (S) · UX-032 admin approvals false empty (XS) · UX-033 approvals error wipes queue (XS) · UX-034 UUID-paste curation (M) · UX-035 picks unviewable without mutating (S).

---

## Release roadmap

**Wave 0 — Today (P0s + rotations, ~2 days):** DB-001 verify/upgrade/drill · ERR-001/002 boundary + chunk reload · COMP-001 privacy policy · INFRA-002 rotations.
**Wave 1 — Launch blockers (≈1 week):** critical path items 3–8 above (legal+consent, OTP hygiene, SMS gate, telemetry, error seam, false-success fixes, check-in resilience).
**Wave 2 — Pre-launch hardening (≈1 week):** pipeline gates (CICD-001/002/003), security+cache headers, indexes migration, billing tests (TEST-001/002), SEO foundation + honesty pass, owner funnel (UX-016/017), ToS, Stripe live cutover.
**Wave 3 — Post-launch (season one):** staging environment, DR/runbook suite, contract backfill, ESLint+coverage+frontend tests, pagination/timeouts, god-file splits, content engine + town pages, self-host fonts, prerender, DSR tooling, audit-ledger gaps.
**Wave 4 — Excellence:** React 19/Vite 8, load testing, RED dashboards, partitioning triggers, design polish (skeletons, URL state, dialog semantics).

---

## Appendix

**Project profile:** solo operator + AI agents; repo age 5 days, 61 commits; CI green (2m27s–4m40s); constitution v1.0.0 binding; budgets main 46.7/130KB gz, check-in 54.1/60KB gz.
**Methodology:** 14 domain agents researched independently against AWS Well-Architected/Google SRE/OWASP/12-Factor-derived checklists plus product-specific constraints (D-004 trust model, D-007 pre-registered experiment, Art. V privacy, house copy style); findings deduplicated and cross-referenced by the orchestrator. Live checks included goodlocal.app headers, robots/sitemap 404s, GitHub branch-protection API, Vercel env scoping, and npm audit.
**Cross-audit confirmations:** Postgres 17-vs-15 doc drift found independently by 3 agents (hosted is 17.6 — fix HANDOFF.md:43); region_interest abuse surface by 3; error-monitoring void by 4; wallet-promise and fake-settings issues by 2 each.
