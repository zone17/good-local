# Advisory-lock serialization + autonomous counters for raise-rollback paths

**Date**: 2026-06-07 · **Context**: closing review findings P1-1/P1-3/P2-6/P2-8 (D-021)

## Problem 1: check-then-act races in SECURITY DEFINER RPCs

`claim_passport` (phone merge) and `redeem_perk` (threshold check) both read
state, decided, then wrote — so two concurrent calls both passed the check.
The merge race surfaced as a raw `patrons.phone` 23505 the errors.js seam
can't map, and could build 2-hop `merged_into` chains that single-hop
`coalesce(merged_into, id)` resolution mishandles. The redeem race
double-redeemed (no natural unique key exists — repeat redemptions across
cycles are legitimate).

## Solution: `pg_advisory_xact_lock` keyed on the contended identity

```sql
-- claim_passport: serialize per phone (before ANY reads of contended state)
perform pg_advisory_xact_lock(hashtextextended(p_phone, 0));

-- redeem_perk: serialize per (patron, perk)
perform pg_advisory_xact_lock(
  hashtextextended(p_patron_ref::text || ':' || p_perk_id::text, 0)
);
```

- Released automatically at commit/rollback — no unlock bookkeeping.
- Under READ COMMITTED each statement re-reads committed state, so the
  serialized second caller *sees the first caller's writes* and takes the
  correct branch (merge instead of insert; PERK_NOT_READY instead of insert).
- Pair with **flatten-on-write** for linked structures: after setting
  `loser.merged_into = winner`, also repoint everyone who pointed at the loser
  (`update patrons set merged_into = winner where merged_into = loser`) so
  single-hop resolution stays canonical forever.
- Keep a `unique_violation` handler anyway (defense in depth) that re-raises a
  contract code — a raw 23505 must never reach a client.

## Problem 2: counters that must survive the rollback their own raise triggers

OTP brute-force lockout needs `attempts := attempts + 1` on every failed
verify — but the failed verify **raises**, which rolls back the increment.
An in-transaction counter literally cannot work.

## Solution: dblink autonomous write (the repo's established pattern)

`flag_reprint_autonomous` already solved this for the CODE_RETIRED reprint
nag. `otp_attempt_autonomous` reuses the pattern: a `dblink_exec` on a fresh
self-connection commits independently, then the main transaction raises and
rolls back everything *except* that write.

**Fail-closed nuance**: the reprint helper swallows dblink errors (the nag
must never mask CODE_RETIRED). The attempts helper deliberately does NOT —
if the autonomous write can't happen, the claim fails closed rather than
leaving the OTP endpoint brute-forceable
(`docs/solutions/fail-closed-dev-affordances.md`). Decide per call site which
failure mode is the safe one.

## Also in this class

- **Atomic consume**: `update otp_codes set consumed_at = now() where id = …
  and consumed_at is null` + `if not found then raise` — one guarded UPDATE,
  no read-then-write window.
- **Claim-first webhook dedup**: INSERT the event id with
  `on conflict do nothing` returning rows *before* side effects (zero rows
  back = someone else holds the claim); delete the claim on side-effect
  failure so the provider's retry re-applies cleanly. SELECT-then-INSERT-last
  double-applies under concurrent duplicate delivery.

## Detection rule

Any SECURITY DEFINER RPC that (a) reads state it later writes, keyed by a
client-supplied identity, or (b) needs to persist anything on a path that
raises — flag it. Tests: fire the verb twice in `Promise.all` and assert
exactly-once semantics plus contract-code (never 23505) failures
(`tests/integration/review-hardening.test.ts`).
