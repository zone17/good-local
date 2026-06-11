-- ============================================================
-- 0018_launch_hardening.sql — spec 002-launch-hardening, wave 1.
--
-- (a) Hot-path indexes (audit PERF-001..004 / DB-007): perk_progress_count
--     runs on every check-in and N x M times per dashboard load with no
--     covering index; the staff rate-limit count and device resolution
--     were sequential scans.
-- (b) Append-only belt-and-braces (audit DB-009): stamps already has an
--     explicit DELETE revoke (0002); the other two audit tables relied on
--     policy absence alone. The merge flow's dedupe-deletes run as the
--     function owner and are unaffected.
-- (c) OTP retention (audit DB-002 / COMP-006): consumed and expired codes
--     are plaintext phone+code pairs; purge them after 30 days instead of
--     accumulating forever.
-- (d) Honest register-kit copy (audit UX-003 / spec FR-011): the printed
--     card promised a wallet add the product does not ship yet; the line
--     also carried an em dash. Only the instructions literal changes.
-- ============================================================

-- ---------- (a) hot-path indexes ----------

create index if not exists perk_redemptions_patron_perk
  on perk_redemptions (patron_id, perk_id, redeemed_at desc);

create index if not exists perk_redemptions_business
  on perk_redemptions (business_id);

create index if not exists stamps_patron_business
  on stamps (patron_id, business_id)
  where trust_valid and voided_at is null;

create index if not exists staff_entries_biz_date
  on staff_entries (business_id, local_date);

create index if not exists patron_devices_patron
  on patron_devices (patron_id);

-- ---------- (b) append-only enforcement ----------

revoke delete on perk_redemptions from anon, authenticated;
revoke delete on steer_impressions from anon, authenticated;

-- ---------- (c) OTP retention purge (daily, after the rotation sweep) ----------
-- cron.schedule upserts by jobname, so re-running this migration is safe.

select cron.schedule(
  'otp-purge',
  '30 9 * * *',
  $job$ delete from otp_codes where created_at < now() - interval '30 days' $job$
);

-- ---------- (d) get_register_kit: honest printed-card instructions ----------

create or replace function get_register_kit(p_business_id uuid default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid := p_business_id;
  v_slug   text;
  v_code   check_in_codes;
  v_interval int;
  v_reprint boolean;
begin
  if v_business_id is null then
    select id into v_business_id from businesses where owner_user_id = auth.uid() limit 1;
    if v_business_id is null then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
  end if;
  perform assert_owns_business(v_business_id);

  select slug into v_slug from businesses where id = v_business_id;

  select * into v_code from check_in_codes
   where business_id = v_business_id and status = 'current'
   limit 1;

  select coalesce(rs.interval_days, 7) into v_interval
  from rotation_schedules rs where rs.business_id = v_business_id;
  if v_interval is null then v_interval := 7; end if;

  v_reprint := exists (
    select 1 from reprint_flags
    where business_id = v_business_id and cleared_at is null
  );

  return json_build_object(
    'business_slug', v_slug,
    'code_value', v_code.value,
    'code_version', v_code.version,
    'qr_url', 'https://goodlocal.app/c/' || v_slug || '?k=' || v_code.value,
    'rotates_at', v_code.created_at + make_interval(days => v_interval),
    'instructions', 'Scan to join. No app needed. Every visit earns a stamp.',
    'reprint_needed', v_reprint
  );
end $$;
