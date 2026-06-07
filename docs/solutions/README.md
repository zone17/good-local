# Solutions — non-obvious learnings

Concise write-ups of problems solved during season-one implementation, captured
per Constitution Art. XXV. Each entry follows symptom → cause → fix → lesson.

| Solution | Tags | One-liner |
|---|---|---|
| [shared-seed-fixture-rot.md](shared-seed-fixture-rot.md) | testing, vitest, supabase | Tests mutating shared seed fixtures rot across runs; one `db reset` per invocation kills the flake class. |
| [split-bundle-identity-fork.md](split-bundle-identity-fork.md) | supabase, auth, vite | Two JS entries with separate auth storage = two anonymous users; a shared `storageKey` unifies the identity. |
| [fail-closed-dev-affordances.md](fail-closed-dev-affordances.md) | security, edge-functions | Dev OTP/mail exposure requires non-prod env AND an explicit `=1` opt-in; unset env = production. |
| [postgres-since-last-redemption-progress.md](postgres-since-last-redemption-progress.md) | postgres, perks | Perk progress defined once in SQL (since last redemption) so every reader agrees and resets correctly. |
| [advisory-locks-and-autonomous-counters.md](advisory-locks-and-autonomous-counters.md) | postgres, concurrency, security | Advisory xact locks serialize check-then-act RPCs; dblink autonomous writes persist counters through raise-rollbacks; claim-first webhook dedup. |
| [adversarial-reviewer-aup-block-on-auth-diffs.md](adversarial-reviewer-aup-block-on-auth-diffs.md) | process, review | Adversarial reviewer personas die on auth/OTP/RLS diffs; defense-framed personas + flush findings to disk immediately. |
