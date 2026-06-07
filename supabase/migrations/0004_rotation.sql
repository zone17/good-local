-- ============================================================
-- 0004_rotation.sql — code rotation function + pg_cron schedule (R2, FR-013)
-- current → grace (grace_hours) → retired; one current per business
-- (partial unique index in 0001). Default weekly / 72h, per-business config.
-- ============================================================

create extension if not exists pg_cron with schema extensions;

-- Rotate one business's code: prior current → grace, mint a new current.
create or replace function rotate_business_code(p_business_id uuid)
returns table (new_version int, grace_until timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_next int;
  v_grace_hours int;
  v_grace timestamptz;
begin
  select coalesce(rs.grace_hours, 72) into v_grace_hours
  from rotation_schedules rs where rs.business_id = p_business_id;
  if v_grace_hours is null then v_grace_hours := 72; end if;
  v_grace := now() + make_interval(hours => v_grace_hours);

  update check_in_codes
     set status = 'grace', rotated_at = now(), grace_until = v_grace
   where business_id = p_business_id and status = 'current';

  select coalesce(max(version), 0) + 1 into v_next
  from check_in_codes where business_id = p_business_id;

  insert into check_in_codes (business_id, value, version, status)
  values (p_business_id, encode(gen_random_bytes(16), 'hex'), v_next, 'current');

  return query select v_next, v_grace;
end $$;

-- Sweep: rotate businesses whose interval has elapsed; retire expired grace codes.
create or replace function rotation_sweep()
returns void
language plpgsql security definer set search_path = public as $$
declare b record;
begin
  -- Retire codes whose grace window has passed.
  update check_in_codes
     set status = 'retired'
   where status = 'grace' and grace_until is not null and grace_until < now();

  -- Rotate each active business whose current code is older than its interval.
  for b in
    select biz.id
    from businesses biz
    join check_in_codes c on c.business_id = biz.id and c.status = 'current'
    left join rotation_schedules rs on rs.business_id = biz.id
    where biz.status = 'active'
      and c.created_at < now() - make_interval(days => coalesce(rs.interval_days, 7))
  loop
    perform rotate_business_code(b.id);
  end loop;
end $$;

-- Nightly sweep at 04:10 region time (09:10 UTC during EDT).
select cron.schedule('rotation-sweep', '10 9 * * *', $$select public.rotation_sweep()$$);
