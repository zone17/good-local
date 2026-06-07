---
title: Adversarial reviewer persona trips AUP cyber safeguards on auth-heavy diffs
date: 2026-06-07
tags: [workflow, code-review, claude-code, auth, otp, review-personas, aup]
---

## Symptom

Mid-review, the session died with a hard API error:

> "API Error: Claude Code is unable to respond to this request, which appears to
> violate our Usage Policy… This request triggered restrictions on violative
> cyber content and was blocked under Anthropic's Usage Policy."
> (req_011Cbp1cFU3EcWt2WSpDaznb, 2026-06-07)

The review had already surfaced 6 findings (1 P1, 2 P2, 3 P3) but they were
never persisted — not to `todos/`, not as PR comments — so the detail was lost
with the session. Only a one-line summary in `.remember/now.md` survived.

## Cause

The `ce-adversarial-reviewer` persona is prompted to "actively construct
failure scenarios to break the implementation." Pointed at a diff heavy on OTP
authentication, phone-based account claiming, and RLS privacy boundaries, its
generated output reads like account-takeover exploit development. Anthropic's
real-time cyber safeguards classify that as offensive-cyber content and block
the request — a false positive on intent, but deterministic given the content
shape. The persona's *attack framing* ("break this auth flow") is the trigger;
the same ground covered with *defense framing* ("verify this auth flow is
safe") passes.

## Fix

Two changes to the review workflow:

1. **Persona selection on auth-heavy diffs**: skip `ce-adversarial-reviewer`
   when the diff touches auth, OTP, session/account claiming, or permission
   checks. Use `ce-correctness-reviewer` + `ce-security-reviewer` instead —
   they cover the same failure modes framed as verification, not exploit
   construction. `/code-review` at medium effort (confidence-gated findings)
   is also safe.

2. **Persist findings incrementally**: review findings must be written to
   `todos/` or posted as PR comments *as they are confirmed*, not held in
   conversation until a final summary. A session can die at any time (API
   error, crash, compaction); findings that exist only in context are lost.

## Lesson

Review personas that simulate attackers are content-indistinguishable from
attack tooling when the code under review is authentication code. Pick
defense-framed personas for auth/OTP/RLS diffs, and treat review findings as
artifacts to flush to disk immediately — the review's value is the persisted
findings, not the conversation. (Crashed review session, 2026-06-07.)

## Now enforced by hook (2026-06-07)

Fix #1 is no longer guidance-only — a `PreToolUse[Agent]` hook,
`~/.claude/hooks/enforcement/adversarial-reviewer-aup-guard.sh`, hard-blocks
any attack-framed adversarial-review persona when EITHER the agent prompt OR
the branch diff vs `main` matches an auth-sensitive pattern (otp, claim_passport,
rls, auth.uid, security definer, session, webhook secret, rate limit, brute
force, account takeover, permission check). The deny message redirects to
ce-correctness-reviewer + ce-security-reviewer. Defense-framed personas and
non-auth diffs pass untouched. Registered in `~/.claude/settings.json` under
`PreToolUse` matcher `Agent`.
