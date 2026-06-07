---
title: Fail-closed dev affordances — unset environment means production
date: 2026-06-06
tags: [security, edge-functions, deno, otp, secrets, fail-closed]
---

## Symptom

A dev convenience — returning the OTP in the HTTP response so local flows can
complete without an SMS provider — risked leaking real OTPs in any environment
where the environment variable that "turns it off" was simply never set. The
naive guard `if (env !== "production") return devOtp` fails open: an unset or
misspelled `ENVIRONMENT` is not `"production"`, so the secret leaks.

## Cause

Dev affordances default-on relative to a single "is this production?" check.
Production is the *absence* of a dev signal, and absence is the default state of
unset config — so the dangerous path is the one you reach by doing nothing.

## Fix

Require **two** positive signals, and treat unset as production:

```ts
// supabase/functions/_shared/otp-core.ts
export function devOtpAllowed(environment, exposeFlag) {
  const env = environment ?? "production";          // unset = assume production
  const envIsLocal = env === "development" || env === "local";
  return envIsLocal && exposeFlag === "1";          // BOTH required
}
```

The dev OTP is exposed only when the environment is *explicitly* non-production
AND a dedicated `EXPOSE_DEV_OTP=1` opt-in is present. The same shape gates dev
mail in `share-weekly-note` via `EXPOSE_DEV_MAIL=1`. Real deployments deliver
OTPs and mail only through the provider (Twilio / Resend); local dev opts in
deliberately.

## Lesson

For any "leak a secret to make dev easier" affordance, make the safe state the
default and require an explicit, dedicated opt-in flag *in addition to* a
non-production environment. Never let "not production" be inferred from an unset
variable — `?? "production"` the environment so misconfiguration fails closed,
not open. (Security review, 2026-06-06.)
