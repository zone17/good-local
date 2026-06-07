-- ============================================================
-- 0009_rpc_discovery.sql — US5 (T046): discovery + business detail.
-- Normative: contracts/api.md §§2.5, 2.6; data-model §2.12 (founding_picks),
-- §5 (verified_regulars_per_business). Constitution Art. I (the ONLY ordering
-- that exists is admin curation — NO computed ranking, ratings, or paid
-- placement; no sort/rank/order/boost/promoted params accepted anywhere).
--
-- get_discovery returns towns ordered by towns.display_order; within each town,
-- picks = curated founding_picks (by display_order) FIRST, then any other active
-- businesses NOT picked, appended ALPHABETICALLY (curation first, never a
-- computed ranking). Counters come ONLY from verified_regulars_per_business
-- (§5 view) — the canonical, trust-valid 2+-stamp counter.
--
-- record_impressions is defined in 0006 and is NOT touched here (T046 note).
--
-- Errors raised with errcode 'P0001' and MESSAGE = the contract code string,
-- read by the seam (errors.js), matching 0005/0006 convention.
-- ============================================================

-- ---------- helper: RFC-3986 percent-encode for directions_url query ----------
-- Postgres has no built-in URL encoder. We percent-encode every byte that is
-- not an unreserved char (A-Z a-z 0-9 - _ . ~). Used to build a stable
-- maps.apple.com `?q=` value from the business name + town.
create or replace function gl_url_encode(p_in text)
returns text
language plpgsql immutable strict set search_path = public as $$
declare
  v_out text := '';
  b int;
  i int;
  v_bytes bytea := convert_to(p_in, 'UTF8');
begin
  for i in 0 .. octet_length(v_bytes) - 1 loop
    b := get_byte(v_bytes, i);
    if (b between 48 and 57)          -- 0-9
       or (b between 65 and 90)       -- A-Z
       or (b between 97 and 122)      -- a-z
       or b = 45 or b = 95 or b = 46 or b = 126 then  -- - _ . ~
      v_out := v_out || chr(b);
    else
      v_out := v_out || '%' || upper(lpad(to_hex(b), 2, '0'));
    end if;
  end loop;
  return v_out;
end $$;

-- ============================================================
-- get_discovery — contract §2.5 (RPC, read).
-- Signature has EXACTLY ONE param (p_town). No ordering/ranking arg exists —
-- calling with any other named arg (e.g. p_sort) errors as an unknown function
-- (Art. I, asserted by the contract test).
-- ============================================================
create or replace function get_discovery(p_town text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_region uuid;
  v_towns jsonb;
begin
  select region_id into v_region from seasons where is_current limit 1;
  if v_region is null then
    raise exception 'REGION_NOT_FOUND' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(town_obj order by town_order), '[]'::jsonb) into v_towns
  from (
    select
      t.display_order as town_order,
      jsonb_build_object(
        'town', t.name,
        'picks', coalesce((
          -- Per-town picks: curated founding_picks first (by display_order),
          -- then remaining active businesses alphabetically. is_pick=0 sorts
          -- before is_pick=1; ties broken by pick order then name.
          select jsonb_agg(pick_obj order by is_pick, pick_order, name)
          from (
            select
              b.slug as business_slug,
              b.name as name,
              b.category as category,
              b.owner_note as owner_note,
              coalesce(vr.verified_regulars, 0)::int as regulars_this_season,
              coalesce(vr.verified_regulars, 0) = 0 as regulars_empty,
              case when fp.id is not null then 'Founding Pick' else null end as curation_label,
              case when fp.id is not null then 0 else 1 end as is_pick,
              coalesce(fp.display_order, 0) as pick_order,
              jsonb_strip_nulls(jsonb_build_object(
                'business_id', b.id,
                'business_slug', b.slug,
                'name', b.name,
                'category', b.category,
                'owner_note', b.owner_note,
                'regulars_this_season', coalesce(vr.verified_regulars, 0)::int,
                'regulars_empty', coalesce(vr.verified_regulars, 0) = 0,
                'curation_label', case when fp.id is not null then 'Founding Pick' else null end
              )) as pick_obj
            from businesses b
            left join founding_picks fp on fp.business_id = b.id and fp.town_id = t.id
            left join verified_regulars_per_business vr on vr.business_id = b.id
            where b.town_id = t.id and b.status = 'active'
          ) per_business
        ), '[]'::jsonb)
      ) as town_obj
    from towns t
    where t.region_id = v_region
      and (p_town is null or t.name = p_town)
  ) towns_q;

  return jsonb_build_object('towns', v_towns);
end $$;

-- ============================================================
-- get_business_detail — contract §2.6 (RPC, read).
-- my_progress reflects the CALLING patron's own stamps + perk progress at this
-- business; null when the patron has no stamps there. directions_url is a
-- maps.apple.com `?q=` deep link built from name + town — chosen because the
-- season-one region (NY/PA river towns) lacks structured addresses in v1, and a
-- name+town query resolves reliably on both iOS (native) and the web fallback,
-- with no third-party maps key required (Art. XII — no extra runtime/secret).
-- ============================================================
create or replace function get_business_detail(p_business_slug text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_biz record;
  v_town text;
  v_patron uuid := current_patron_id();
  v_regulars int;
  v_my_count int;
  v_my_perks jsonb;
  v_my_progress jsonb;
  v_directions text;
begin
  select b.id, b.slug, b.name, b.category, b.hours, b.owner_note, b.status, t.name as town_name
    into v_biz
  from businesses b join towns t on t.id = b.town_id
  where b.slug = p_business_slug;

  if v_biz.id is null or v_biz.status <> 'active' then
    raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0001';
  end if;
  v_town := v_biz.town_name;

  select coalesce(verified_regulars, 0)::int into v_regulars
  from verified_regulars_per_business where business_id = v_biz.id;
  v_regulars := coalesce(v_regulars, 0);

  -- my_progress: only when an authenticated patron has stamps here.
  v_my_progress := null;
  if v_patron is not null then
    select count(*) into v_my_count
    from stamps
    where patron_id = v_patron and business_id = v_biz.id
      and trust_valid and voided_at is null;

    if v_my_count > 0 then
      select coalesce(jsonb_agg(jsonb_build_object(
               'perk_id', p.id,
               'current', v_my_count,
               'threshold', p.visit_threshold
             ) order by p.visit_threshold), '[]'::jsonb)
        into v_my_perks
      from perks p
      where p.business_id = v_biz.id and p.status = 'active';

      v_my_progress := jsonb_build_object('stamp_count', v_my_count, 'perks', v_my_perks);
    end if;
  end if;

  v_directions := 'https://maps.apple.com/?q='
                  || gl_url_encode(v_biz.name || ', ' || v_town);

  return jsonb_build_object(
    'business_id', v_biz.id,
    'business_slug', v_biz.slug,
    'name', v_biz.name,
    'town', v_town,
    'category', v_biz.category,
    'hours', case when jsonb_typeof(v_biz.hours) = 'object'
                  then coalesce(v_biz.hours ->> 'text', '')
                  else coalesce(v_biz.hours #>> '{}', '') end,
    'owner_note', coalesce(v_biz.owner_note, ''),
    'directions_url', v_directions,
    'regulars_this_season', v_regulars,
    'regulars_empty', v_regulars = 0,
    'my_progress', v_my_progress
  );
end $$;

-- ---------- Grants ----------
grant execute on function gl_url_encode(text)         to anon, authenticated;
grant execute on function get_discovery(text)         to anon, authenticated;
grant execute on function get_business_detail(text)   to anon, authenticated;
