# Consolidated Review Findings — PR #1 (001-upper-delaware-passport)

Date: 2026-06-07. Re-run of the crashed 2026-06-07 review using defense-framed
personas (correctness, security, data-migration). Source detail:
`review-correctness.md`, `review-security.md`, `review-migrations.md`.

## Reconciliation with the lost review

| Lost finding | Verdict |
|---|---|
| P1 claim_passport merge collision | **Confirmed, reframed**: not data loss in the happy path (dup-stamp handling is correct), but the merge has NO locking — concurrent same-phone claims hit `patrons.phone` UNIQUE and can build 2-hop `merged_into` chains that single-hop resolution mishandles |
| 2× P2 races | **Confirmed**: redeem_perk TOCTOU + Stripe webhook dedup race |
| 3× P3 scope bugs | **2 confirmed** (SQL scoping: business-detail progress, regulars sort). Third (React hook scoping) refuted — no `src/hooks/` exists; only design mockups use JSX |

## P1 — fix before merge

1. **`claim_passport` merge unserialized** — `supabase/migrations/0006_rpc_checkin.sql:477-593`
   No `FOR UPDATE`/advisory lock on `v_current`/`v_phone_holder` reads. Concurrent
   same-phone claims: second committer hits `patrons.phone` UNIQUE (raw 23505, see #2);
   interleaved merges can create a 2-hop `merged_into` chain that
   `coalesce(merged_into, id)` resolves to a non-canonical row.
   **Fix**: `pg_advisory_xact_lock(hashtextextended(p_phone, 0))` after OTP verify;
   make merged_into resolution recursive (or assert chains are flattened on write).

2. **Claim path lacks `unique_violation` handler** — `0006_rpc_checkin.sql:508,526-528`
   Unlike `record_check_in:286`/`staff_check_in:387`, collisions abort with raw
   Postgres `23505` the errors.js seam can't map. **Fix**: add
   `exception when unique_violation` → contract error code.

3. **No rate limiting on OTP send/verify** — `claim-passport/index.ts:73-83`,
   `0006_rpc_checkin.sql:495-508`. 6-digit code, 10-min validity, no attempt
   counter, no send cap. **Fix**: per-phone send cap + verify attempt counter
   with lockout; consider consuming the OTP on Nth failed attempt.

4. **Stripe webhook secret fails open** — `stripe-webhook/index.ts:23`
   `?? "whsec_local_test"` means an unset `STRIPE_WEBHOOK_SECRET` accepts events
   signed with a committed literal. Violates the fail-closed pattern
   (docs/solutions/fail-closed-dev-affordances.md). **Fix**: throw on unset; dev
   opt-in via explicit flag only.

5. **Public views bypass RLS** — `0003_views.sql:12-153`
   `valid_stamps`, `owner_visit_pattern_14d`, gate views are not
   `security_invoker`, so they read with owner privileges; SELECT not revoked
   from app roles → reachable via PostgREST around `stamps`/`patrons` RLS.
   **Fix**: `alter view ... set (security_invoker = true)` or revoke app-role
   SELECT and front with SECURITY DEFINER RPCs that check authz.

## P2

6. **`redeem_perk` TOCTOU → double redemption** — `0007_rpc_redeem.sql:207-215`
   Threshold read → check → insert with no lock and no unique constraint on
   `perk_redemptions` (`0001_schema.sql:171-179` — PK only). Concurrent redeems
   both pass. **Fix**: `pg_advisory_xact_lock` keyed on (patron, perk) before
   the threshold check.

7. **Stripe webhook dedup is check-then-insert** — `_shared/stripe-webhook-core.ts:114-125,151-153,260`
   `alreadyProcessed` SELECT and `markProcessed` INSERT are separate steps;
   concurrent at-least-once delivery double-applies side effects, second INSERT
   throws uncaught dup-key → 500 + Stripe retry. **Fix**: INSERT-first with
   `on conflict do nothing`, gate side effects on rows-inserted.

8. **OTP consume is check-then-update** — `0006_rpc_checkin.sql:495-508`
   Concurrent claims can both pass OTP verification with one code. Largely
   subsumed by the advisory lock in P1-1, but consume should be a single
   `update ... where consumed_at is null returning *`.

9. **Merge repoints silently orphan loser rows** — `0006_rpc_checkin.sql:563-581`
   `steer_impressions`, `milestone_unlocks`, `patron_devices` repoint only
   `where not exists (winner dup)`; colliding rows stay on the merged-away
   loser, invisible through `current_patron_id()` RLS. (`stamps` handled
   correctly via void-then-repoint.) **Fix**: void-or-merge semantics for the
   three tables, mirroring the stamps approach.

10. **`perk_redemptions` repoint can duplicate redemption history** — `0006_rpc_checkin.sql:569`
    Unconditional repoint; audit double-counts and reset window can key off the
    loser's timestamp. **Fix**: dedupe on repoint, keep `max(redeemed_at)`.

11. **`gate_metrics_evaluated()` callable by PUBLIC, no internal authz** — `0011_rpc_admin.sql:362-401`
    Default PUBLIC EXECUTE never revoked; function lacks `assert_admin()`.
    **Fix**: `revoke execute ... from public` + add body-level check.

## P3

12. **`get_business_detail` progress ignores reset rule** — `0009_rpc_discovery.sql:151-166`
    Uses lifetime count instead of `perk_progress_count` (since-last-redemption);
    business-detail shows inflated progress after redemption. **Fix**: call
    `perk_progress_count(v_patron, p.id)` per perk.

13. **`get_business_regulars` sorts visits as text** — `0013_rpc_regulars.sql:35`
    `order by row->>'visits' desc` is lexicographic (9 > 10). **Fix**: cast
    `(row->>'visits')::int`.

14. **`perk_progress_count` accepts arbitrary patron_id, granted to authenticated** —
    `0007_rpc_redeem.sql:28-56,236`. Minor cross-patron integer leak. **Fix**:
    derive patron from `current_patron_id()` or revoke direct grant.

15. **`staff_check_in` find-or-create race on phone** — `0006_rpc_checkin.sql:367-370`
    Second concurrent new-phone entry hits UNIQUE as raw 23505. **Fix**:
    `on conflict` upsert or catch + retry select.

16. **Seed not robustly idempotent** — `supabase/seed/seed.sql:32-43`
    `on conflict do nothing` without matching unique keys (`regional_milestones`
    has none → re-seed duplicates). **Fix**: add the unique keys and target them.

## Residual risks (not filed)

- `dblink` autonomous write uses hardcoded `postgres/postgres` local creds
  (`0006_rpc_checkin.sql:36-64`) — fine locally, must not ship to hosted.
- `rotate_business_code` max(version)+1 race — admin/cron-only, low risk.

## Testing gaps to close alongside fixes

- Concurrent `claim_passport` for one phone (two simultaneous calls)
- Concurrent `redeem_perk` same patron+perk
- Duplicate/concurrent Stripe webhook delivery (idempotent side effects)
- Business-detail progress reset after redemption
- Regulars ordering across digit-length boundaries
- Merge with colliding `steer_impressions`/`milestone_unlocks`/`patron_devices`
