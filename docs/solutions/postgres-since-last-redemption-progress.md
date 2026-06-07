---
title: Define perk progress once in SQL — the since-last-redemption reset bug
date: 2026-06-06
tags: [postgres, rpc, perks, redemption, single-source-of-truth]
---

## Symptom

After a patron redeemed a perk, their progress did not reset. A "buy 5, get 1"
perk kept showing 6/5, 7/5, … and let the same patron redeem again immediately.
Different surfaces also disagreed: the check-in confirmation showed one count,
the dashboard another.

## Cause

The original check-in progress logic (migration 0006) counted **all** of the
patron's trust-valid stamps at the business. That count never decreases, so it
could never reset after a redemption. And because progress was computed inline
in more than one place, the check-in path and the redeem path used subtly
different definitions — they drifted.

## Fix

Define progress exactly once and have every reader call it. Progress is the
count of trust-valid, non-voided, current-season stamps at the business created
**strictly after** the patron's most-recent redemption of *that* perk (or all
such stamps if never redeemed):

```sql
-- supabase/migrations/0007_rpc_redeem.sql
create or replace function perk_progress_count(p_patron_id uuid, p_perk_id uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare v_business_id uuid; v_last_redeem timestamptz; v_count int;
begin
  select business_id into v_business_id from perks where id = p_perk_id;
  select max(redeemed_at) into v_last_redeem
    from perk_redemptions where patron_id = p_patron_id and perk_id = p_perk_id;
  select count(*) into v_count
    from stamps s join seasons se on se.id = s.season_id and se.is_current
   where s.patron_id = p_patron_id and s.business_id = v_business_id
     and s.trust_valid and s.voided_at is null
     and (v_last_redeem is null or s.created_at > v_last_redeem);
  return coalesce(v_count, 0);
end $$;
```

`0007` then `create or replace`s `checkin_progress` (keeping its signature) to
call `perk_progress_count`, so `record_check_in`, `staff_check_in`, the
passport, the dashboard, and `redeem_perk` all share the one definition.
Redeeming inserts a redemption at `now()`; the next read counts only stamps
after it → resets to 0, and the following stamp shows 1 of threshold.

## Lesson

A business rule that more than one reader needs (here: "how far along is this
perk?") must be a single named function, not inline SQL copied per call site.
The reset bug was really two bugs — a wrong definition AND a duplicated one;
centralizing fixed both and made the rule auditable in one place.
