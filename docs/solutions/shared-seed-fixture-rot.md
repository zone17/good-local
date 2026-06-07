---
title: Shared seed fixtures rot when tests mutate them across runs
date: 2026-06-06
tags: [testing, vitest, supabase, fixtures, flake]
---

## Symptom

Integration/contract suites passed from a fresh `supabase db reset` but went red
on re-runs without a reset. Failures were order-dependent: a suite that renamed,
suspended, or redeemed against the seeded demo business ("The Heron") left state
that a later (or the same) suite assumed was pristine. Symptoms also included
`auth.admin.listUsers` not returning a user that "should" exist, and uniqueness
collisions on fixed-email accounts created by an earlier run.

## Cause

The suites share one local Postgres and legitimately mutate shared seed
fixtures. Two specific traps:

1. **Accumulated mutation.** Per-suite "restore what I changed" cleanup is
   fragile — it only undoes what each author remembered to undo, and breaks the
   moment suites run in a different order. State accumulates run over run.
2. **Fixed-email + listUsers page-1.** Tests that created owners/admins with a
   fixed email collided on re-run, and lookups via `listUsers` only scanned the
   first page, so a user beyond page 1 looked absent.

## Fix

Reset the whole database once per test invocation in Vitest `globalSetup`
instead of restoring per-suite:

```ts
// tests/setup/global-setup.ts (essence)
export default function globalSetup(): void {
  if (process.env.SKIP_DB_RESET === "1") return;     // fast single-file iteration
  // cooperative /tmp/gl-db-lock mutex (shared with impl agents) …
  execFileSync("supabase", ["status"], { stdio: "ignore" }); // stack must be up
  execFileSync("supabase", ["db", "reset"], { stdio: "pipe", timeout: 180_000 });
}
```

Wired via `vitest.config.ts` (`globalSetup`, plus `fileParallelism: false` /
single-thread because all files share the one DB). This makes local behavior
identical to CI, which resets once per job. For fast iteration against existing
state: `SKIP_DB_RESET=1 npx vitest run <file>`.

For the email/listUsers traps: use per-run-unique emails (or delete-then-create
under the reset) and never assume `listUsers` page 1 contains your user —
look up by email/id directly.

## Lesson

When suites share a mutable database, make the *baseline* cheap and total
(one reset per run) rather than making each suite responsible for cleaning up
after itself. Per-suite restore is O(authors remembering) and rots; a single
reset is O(1) and matches CI exactly. Keep an env opt-out for iteration speed.
