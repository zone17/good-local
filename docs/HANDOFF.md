# Good Local — Engineering Handoff

> **Last updated:** 2026-06-11 · Living doc. Update the "Status" and "Next steps"
> sections as work lands. This repo is **public** — never paste secrets here
> (keys, passwords, tokens). Reference *where* a secret lives, not its value.

---

## 1. What this is (30 seconds)

**Good Local — The Upper Delaware Passport.** A regional loyalty + discovery
platform. Patrons add a free passport to their phone wallet, earn a **stamp per
visit** at independent local businesses, and unlock perks; businesses pay **$79/mo**
for their own loyalty program that compounds into one regional passport.

The product is a **platform**: the **Upper Delaware (NY/PA) is region one of many**
("your region could be next"). Two loops: **depth** (repeat visits to the same
business — what owners renew for) and **breadth** (a season passport across ~12
river towns). Discovery is ranked by **verified return visits, never paid
placement**. Full thesis: `docs/prfaq-good-local.md` + `docs/discovery/`.

It is **LIVE in production** at **https://goodlocal.app**.

---

## 2. Current status

| Area | State |
|---|---|
| Patron passport (`/app`), check-in (`/c/{slug}`) | ✅ Live |
| Business dashboard (`/business`) + self-serve signup (`/business/signup`) | ✅ Live |
| Admin (`/admin`): approvals, picks, rotation, gates, staff audit, **Content**, **Regions** | ✅ Live |
| Marketing landing (`/`), Blog (`/blog`), Podcast (`/podcast`) | ✅ Live |
| New-business registration → Stripe checkout | ✅ Live in **TEST mode** (real charges need live keys — see Next steps) |
| Region-interest capture (movement section form) | ✅ Live |
| CI (frontend, typecheck, tests, e2e, brand) + CD to Vercel | ✅ Green |

---

## 3. Architecture & where things live

**Stack:** Vite + React (no router lib — path matching in `app/src/App.jsx`),
Supabase (Postgres 15 + RLS + Auth + Edge Functions/Deno), Stripe subscriptions,
Vercel hosting (CD), Cloudflare DNS. Spec-Kit driven (`specs/001-upper-delaware-passport/`).

**Two frontend entries:** the main app and a lean check-in bundle
(`app/src/checkin/`) served at `/c/*` via a `vercel.json` rewrite. Every route
component is `React.lazy`-loaded; the **Supabase SDK lives only in lazy chunks**,
never the main entry (D-028). Budgets: main ≤130KB gz (currently ~47KB), check-in
≤60KB (~54KB) — enforced by `.github/scripts/check-size.mjs`.

**Routes** (`app/src/App.jsx`, matched with an anchored `at()` helper):
`/` landing · `/app` patron · `/blog` + `/blog/{slug}` · `/podcast` ·
`/business` + `/business/signup` · `/admin` · `/c/{slug}` checkin (separate bundle).

**Key code:**
- `app/src/marketing/` — Landing, Chrome (nav/footer), Blog, Podcast, RegionInterestForm, `useContent.js` (blog/podcast read hooks + `renderMarkdown`), `regionInterest.js` (SDK-free fetch).
- `app/src/admin/AdminApp.jsx` — admin surfaces incl. **Content** (blog/podcast CMS) and **Regions** (lead list). `AdminRoute.jsx` is the lazy auth gate.
- `app/src/patron/`, `app/src/business/` — the two app surfaces.
- `app/src/lib/api.js` — the read-only RPC seam; `auth.js` — the shared Supabase client.
- `design/` — vendored design system (`@ds` alias). Brand rules enforced by `scripts/check-brand.mjs` (no emoji, no rating affordances, plain voice).

**Database:** 17 migrations (`supabase/migrations/0001…0017`). Content tables:
`blog_posts`, `podcast_episodes` (0016), `region_interest` (0017) — all
**RLS: public reads published / anon-insert for leads; only `is_admin()` writes.**
5 edge functions: `claim-passport`, `create-checkout-session`, `stripe-webhook`,
`update-subscription-plan`, `share-weekly-note`.

**The CMS is Supabase, not an external vendor.** Blog posts, podcast episodes, and
region leads are authored from `/admin` → Content / Regions tabs. Podcast *audio*
is hosted externally (Transistor/Spotify-for-Podcasters); admin stores embed +
listen URLs only.

---

## 4. Production infrastructure

- **App:** Vercel project `good-local` (team `zone17`), **CD on every push to `main`** via the GitHub integration. Custom domain **goodlocal.app** (Cloudflare DNS, apex CNAME-flatten, `www`→apex redirect, auto SSL). Also `good-local.vercel.app`.
- **Database/Auth:** hosted Supabase, project ref **`vrzwrnpqfpsxlrbiyzem`**. Direct/pooler conn via `aws-1-us-east-1.pooler.supabase.com`. Anonymous sign-ins are **enabled** (patron flow).
- **Repo:** `zone17/good-local`, **public** (gives unlimited GitHub Actions; do not paste secrets in code/docs).
- **Secrets (where, not what):** DB password in `~/.good-local-db-password`. Supabase Edge secrets (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_FOUNDING`, `STRIPE_WEBHOOK_SECRET`) set via `supabase secrets`. Vercel/Cloudflare tokens in the operator's CLI auth + private notes. Demo account credentials (admin, owner, perk-ready patron) live in the operator's private memory — **not** in this repo.

---

## 5. How we work (conventions you must follow)

- **Compound Engineering loop** (Plan → Work → Review → Compound). ~80% planning/review. Decisions recorded in **`DECISIONS.md`** (`D-001…D-031`); read it — it's the fastest way to understand *why* the code is shaped this way.
- **Branch discipline (hook-enforced):** never commit/push on `main`. Branch (`feat|fix|perf/...`), PR, `--no-review` only when justified (CI green + small/verified). `gh pr merge --merge`.
- **CI gate (hook-enforced):** after any push/PR/merge you **must run `/watch-ci`** before other bash runs. Watch → green → merge → watch main → confirm Vercel deploy.
- **Marketing copy house style: NO DASHES.** No em/en dashes or hyphen-as-punctuation in any landing/blog/podcast/meta copy (e.g. "river town", not "river-town"). Self-scan before shipping; `check-brand.mjs` does **not** catch dashes.
- **Security model:** RLS is the authority. Writes to content/business/patron tables gate on `is_admin()` / ownership. `renderMarkdown` is escape-first + http(s)-only (XSS-safe) and admin-authored. **Never run `ce-adversarial-reviewer` on auth/OTP/RLS diffs** (hook-blocked — use defense-framed review).
- **Migrations:** dollar-quote (`$md$…$md$`) body text to avoid the recurring doubled-apostrophe bug. After a hosted `db push`, run `NOTIFY pgrst, 'reload schema';` or the new table 404s in PostgREST.

---

## 6. Known gotchas / traps

- **Supabase CLI is pinned to `2.105.0` in CI** (`.github/workflows/ci.yml`, D-031). **v2.106.0 (2026-06-11) broke `service_role` grants** → contract/e2e suites fail with "permission denied for table seasons/patrons" with no code change. Don't bump to `latest` without re-verifying; if a future CLI keeps that behavior, migrations may need explicit `service_role` grants.
- **CI flakes:** the Supabase CLI install can hit a GitHub API rate limit ("Failed to resolve latest release") — rerun. Storage is disabled in `supabase/config.toml` (was a 502 health-check flake).
- **Stripe today is TEST mode.** Live charges need live keys + a live webhook (see Next steps). A test secret key was pasted in chat earlier and should be **rotated**.
- **Markdown link limitation:** URLs containing a literal `)` get truncated by `renderMarkdown` (documented, rare for our content).

---

## 7. Next steps (priority order)

1. **Stripe live mode** (unblocks real revenue): create a **live** product + $79/mo price + webhook endpoint (`https://vrzwrnpqfpsxlrbiyzem.supabase.co/functions/v1/stripe-webhook`), set the **live** `STRIPE_SECRET_KEY` / `STRIPE_PRICE_FOUNDING` / `STRIPE_WEBHOOK_SECRET` Supabase secrets, and test a real signup. **Rotate** the exposed test key first. (Test-mode flow already verified end-to-end: signup → checkout → webhook → admin approve.)
2. **Seed real launch content:** write the first 1–3 real **blog** posts and publish the first **podcast** episode (host the audio externally, then add embed + Apple/Spotify URLs in `/admin` → Content). Pages are live but thin.
3. **Use region demand:** the `/admin` → **Regions** tab now collects "bring Good Local to my town" leads with per-region counts — this is the expansion signal for region two.
4. **Launch gating (from the PR/FAQ):** June 30 target is gated on build readiness + co-founder Mel signing **≥10 paying founding businesses by June 20**; if under, the date moves, scope doesn't.
5. **Security hygiene:** rotate the Cloudflare API tokens and the Stripe test key that were shared in operator chat earlier.
6. **Older review backlogs:** `todos/review-*.md` (consolidated/correctness/migrations/security) predate this session — triage whether any items are still open. The marketing review backlog (`todos/2026-06-09-marketing-surface-review.md`) is **fully closed**.

---

## 8. Fast orientation checklist for the next agent

1. `git branch --show-current` (start on the right branch; never work on `main`).
2. Read **`DECISIONS.md`** top-to-bottom (D-031 → D-001) — the "why".
3. Skim `specs/001-upper-delaware-passport/plan.md` (the canonical plan, referenced by `CLAUDE.md`).
4. Read `docs/prfaq-good-local.md` §"Internal FAQ" for the product bet + risks.
5. `docs/solutions/` and `docs/solutions/patterns/` — reusable patterns + traps.
6. Bring up the app: build in `app/`, or just open https://goodlocal.app.
7. Before any DB-touching work, remember the **CLI pin** and the **RLS-first** model.
