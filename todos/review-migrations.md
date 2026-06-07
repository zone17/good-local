# Migration & Data-Integrity Review — 001-upper-delaware-passport

Base: `git merge-base main 001-upper-delaware-passport` = ea98e54. All 13
migrations + seed are net-new on this branch (whole feature). No `db/schema.rb`
or `structure.sql` in repo (Supabase SQL migrations), so Step 0 schema-drift does
not apply.

## [P1] claim_passport merge has no locking — concurrent claims of the same phone race
- **File**: supabase/migrations/0006_rpc_checkin.sql:477-593
- **What**: `claim_passport` reads `v_current` (line 511) and `v_phone_holder`
  (line 517) with no `SELECT ... FOR UPDATE` and no advisory lock. Two concurrent
  invocations for the same phone (double-submit, client retry, two devices) each
  snapshot the patron set before either commits. Both can independently decide
  who the winner/loser is and both run the re-point UPDATEs. Failure modes:
  (a) two new auth users claiming the same phone both take the
  `v_phone_holder is null` branch (line 523) and both run
  `update patrons set phone = p_phone where id = v_winner` (line 526) on their own
  distinct rows; the second to commit violates the `patrons.phone` UNIQUE
  constraint (0001_schema.sql:120) and raises a raw `23505`, not a contract code;
  (b) interleaved merges can re-point the same loser stamps twice or leave a
  patron whose `merged_into` points at a row that was itself merged in the other
  transaction (chained merge — `coalesce(merged_into, id)` only follows one hop in
  `resolve_patron`/`current_patron_id`, so a 2-level chain resolves to a
  non-canonical row). There is no serialization guaranteeing one-claim-at-a-time
  per phone.
- **Fix**: Take a deterministic lock before reading patron state, e.g.
  `perform pg_advisory_xact_lock(hashtextextended(p_phone, 0));` immediately after
  OTP verification, so all claims for a given phone serialize. Additionally make
  merged_into resolution recursive (or flatten chains on merge) so multi-hop
  merges still resolve to the canonical patron.

## [P1] Unhandled UNIQUE violations in claim_passport surface as raw 23505, not contract error codes, and consume the OTP
- **File**: supabase/migrations/0006_rpc_checkin.sql:508,526-528
- **What**: The OTP is consumed at line 508 (`update otp_codes set consumed_at`)
  before any merge/identity work. The subsequent `update patrons set phone = ...`
  (line 526) and the merge-branch repoints can violate `patrons.phone` UNIQUE
  (0001:120) or other unique keys under the race above. Because there is no
  `exception when unique_violation` block (unlike record_check_in:286 and
  staff_check_in:387 which translate to `DAILY_LIMIT`), the function aborts with a
  raw Postgres `23505`. The whole transaction rolls back — including the OTP
  consume — so the OTP is not permanently stranded, but the client receives an
  un-mapped error instead of a clean contract code (the errors.js seam reads the
  code from the message; `23505` has no contract string), degrading the claim UX
  and making the failure indistinguishable from a server fault.
- **Fix**: Wrap the identity/merge writes in
  `begin ... exception when unique_violation then raise exception 'PHONE_TAKEN'
  (or the appropriate §7 contract code) using errcode = 'P0001'; end;` so the
  concurrency loser gets a deterministic, retryable contract error. Pair with the
  advisory lock above to make the race impossible in the first place.

## [P2] Best-effort fact repoints silently drop loser rows on unique collision (steer_impressions, milestone_unlocks, patron_devices)
- **File**: supabase/migrations/0006_rpc_checkin.sql:563-581
- **What**: For steer_impressions, milestone_unlocks, and patron_devices the merge
  re-points the loser's rows to the winner only `where not exists (... winner
  already has the same key ...)`. Rows that DO collide on the unique key are left
  pointing at the loser patron (`v_loser`) and are never voided or deleted. After
  the loser is marked `merged_into = v_winner` (line 584), those orphaned rows
  belong to a non-canonical patron: queries that resolve through
  `current_patron_id()`/`coalesce(merged_into,id)` will never see them, and
  RLS policies keyed on `patron_id = current_patron_id()` (0002_rls.sql:103,112,
  129) will hide them from the winner. This is silent data loss / orphaning of the
  loser's colliding impressions, milestone unlocks, and device links. (stamps are
  handled correctly via the void-then-repoint two-step at lines 537-560; these
  three tables are not.)
- **Fix**: Mirror the stamps pattern — for collisions, either delete the loser's
  duplicate rows explicitly, or repoint the surviving canonical row and drop the
  dup, so no row remains attached to the merged-away loser. At minimum, after all
  repoints, assert `not exists (select 1 from <table> where patron_id = v_loser)`
  for each table and fail loudly rather than leaving orphans.

## [P2] perk_redemptions repoint can create duplicate redemption history and skew progress reset
- **File**: supabase/migrations/0006_rpc_checkin.sql:569
- **What**: `update perk_redemptions set patron_id = v_winner where patron_id =
  v_loser` is unconditional (no de-dup). If both winner and loser independently
  redeemed the same perk, after merge the winner has two redemption rows for that
  perk. perk_progress_count (0007:43-45) uses `max(redeemed_at)` so the progress
  reset still keys off the latest, so this is not a correctness break for the
  reset rule — but it does double-count redemption history (audit/analytics) and,
  combined with the stamp void-on-merge, can make a merged patron's "since last
  redemption" window start at the wrong (loser's) redemption timestamp. No unique
  constraint on (patron_id, perk_id) exists to catch it.
- **Fix**: Document the intended redemption-history semantics on merge. If
  duplicates are undesirable, de-dup on repoint or add a uniqueness/ordering
  guarantee. If duplicates are acceptable, add a comment stating that
  perk_progress_count is intentionally max()-based so the merge is safe.

## [P3] staff_check_in find-or-create patron by phone is not concurrency-safe
- **File**: supabase/migrations/0006_rpc_checkin.sql:367-370
- **What**: `select coalesce(merged_into, id) ... from patrons where phone =
  p_phone; if v_patron is null then insert into patrons (phone) ...`. Two
  concurrent staff entries for a new phone both read null and both insert; the
  second hits `patrons.phone` UNIQUE (0001:120) and raises raw `23505` (no
  exception mapping). Lower severity than claim_passport because staff entries are
  rate-limited and serialized per business in practice, but the get-or-create is
  still racy.
- **Fix**: Use `insert into patrons (phone) values (p_phone) on conflict (phone)
  do nothing returning id`, then re-select, or wrap in an advisory lock on the
  phone.

## [P3] Seed gate_thresholds / seasons rely on `on conflict do nothing` without a conflict target on rows that have no natural unique key
- **File**: supabase/seed/seed.sql:32-34,39-43
- **What**: The seasons and regional_milestones inserts use bare
  `on conflict do nothing`. seasons has no unique constraint on
  (region_id, name) — only the partial `one_current_season` index on
  `is_current` (0001:52). Re-running the seed with `is_current = true` for a
  second season name would not conflict on name (no constraint) but WOULD violate
  the partial unique index, and `on conflict do nothing` without a matching
  arbiter index for that exact predicate can raise rather than no-op in some
  re-seed scenarios. Net: the seed is only idempotent for the exact same single
  current season; it is not robustly re-runnable if the current-season row
  changes. regional_milestones has no unique key at all, so `on conflict do
  nothing` is a no-op guard that does nothing — re-running duplicates milestones.
- **Fix**: Give seasons a `unique (region_id, name)` and regional_milestones a
  `unique (region_id, season_id, name)` (or `(season_id, threshold, kind)`), then
  target those in `on conflict`. This makes the seed truly idempotent and keeps
  it from drifting from migration-defined constraints.
