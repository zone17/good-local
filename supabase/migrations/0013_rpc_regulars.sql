-- ============================================================
-- 0013_rpc_regulars.sql — get_business_regulars (contract §3.10, added T064)
--
-- WHY: the owner Regulars view shipped against mock data; removing the mock
-- seam exposed that no verb backed it. This is the owner-scoped patron
-- relationship list — permitted by Art. V (own-business rows only; a patron's
-- OTHER businesses are never visible). No invented data: only fields we truly
-- have (display name may be null for anonymous patrons; the client renders
-- the honest fallback).
-- ============================================================

create or replace function get_business_regulars(p_business_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_biz uuid;
  v_out jsonb;
begin
  -- Resolve the target business: explicit id or the caller's own business.
  if p_business_id is not null then
    select id into v_biz from businesses
     where id = p_business_id
       and (owner_user_id = auth.uid() or is_admin());
  else
    -- Deterministic when an owner has multiple businesses (test fixtures do):
    -- the oldest one is "their" business; explicit p_business_id overrides.
    select id into v_biz from businesses
     where owner_user_id = auth.uid()
     order by created_at asc limit 1;
  end if;
  if v_biz is null then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(row order by row->>'visits' desc), '[]'::jsonb) into v_out
  from (
    select jsonb_build_object(
      'patron_ref', s.patron_id,
      'display_name', max(p.display_name),
      'visits', count(*),
      'since', min(s.local_date),
      'last_visit', max(s.local_date),
      'trend', case
        when min(s.local_date) >= current_date - 13 then 'new'
        when count(*) filter (where s.local_date >= date_trunc('week', current_date)::date)
           > count(*) filter (where s.local_date >= (date_trunc('week', current_date) - interval '7 days')::date
                                and s.local_date <  date_trunc('week', current_date)::date)
          then 'up'
        else 'steady'
      end
    ) as row
    from valid_stamps s
    join patrons p on p.id = s.patron_id
    where s.business_id = v_biz
    group by s.patron_id
  ) t;

  return v_out;
end $$;
