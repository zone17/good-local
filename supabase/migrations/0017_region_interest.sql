-- ============================================================
-- 0017_region_interest.sql — "bring Good Local to your region" lead capture (D-029).
--
-- Backs the public form in the landing's "Region one of many" section. Anyone
-- may submit interest (anon INSERT); only admins may read the list. Column
-- CHECKs bound field sizes and validate the email shape so the open insert
-- endpoint can't be filled with oversized junk.
-- ============================================================

create table if not exists region_interest (
  id         uuid primary key default gen_random_uuid(),
  region     text not null check (char_length(region) between 1 and 120),
  email      text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                                  and char_length(email) <= 200),
  role       text check (role is null or role in ('patron', 'business')),
  note       text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index region_interest_created on region_interest (created_at desc);

alter table region_interest enable row level security;

-- Public lead capture: anyone may INSERT a row (CHECK constraints bound it),
-- but only admins may SELECT. No update/delete for non-admins.
create policy region_interest_insert on region_interest
  for insert to anon, authenticated with check (true);
create policy region_interest_admin_read on region_interest
  for select using (is_admin());
create policy region_interest_admin_write on region_interest
  for all using (is_admin()) with check (is_admin());

grant insert on region_interest to anon, authenticated;
grant select, update, delete on region_interest to authenticated;
