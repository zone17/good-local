---
title: Two JS entries with separate auth storage create two anonymous users
date: 2026-06-06
tags: [supabase, auth, vite, bundle-splitting, identity, anonymous]
---

## Symptom

A patron scanned the register QR (the lean `/c/` check-in bundle), earned stamp
#1, then opened the passport home (the main SPA bundle) — and the passport
showed zero stamps. They appeared to be two different people. A subsequent phone
claim merged the wrong pair of identities, or left an orphan "empty" passport.

## Cause

The two entries each call `createClient()` independently. Supabase persists the
session in `localStorage` under a `storageKey`. With different (or default,
project-derived but per-instance-divergent) keys, each bundle obtained its own
**anonymous** session. The scan created anon-user A; the passport home created
anon-user B. Same browser, same person, two identities — the stamp lived on A,
the passport read B.

## Fix

Construct both clients with the **same** `storageKey` and full session
persistence so one anonymous session spans both entries:

```js
// app/src/lib/auth.js AND app/src/checkin/checkin-api.js
createClient(URL, ANON_KEY, {
  auth: {
    storageKey: "gl-auth",   // identical in both bundles — one identity
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
```

Now the first scan's anonymous session is the one the passport reads; stamp #1
shows up immediately, and a later phone claim merges the single correct identity.

## Lesson

Splitting a frontend into multiple entries for performance silently splits
client-side auth state too, because session storage is keyed per client. Any
time two bundles must act as the same user, pin a shared `storageKey` (and
persistence + refresh) deliberately. Treat "is this the same identity across
entries?" as a first-class design question whenever you split bundles.
