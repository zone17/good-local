-- ============================================================
-- 0002_rls.sql — Row-Level Security: the privacy boundary as policy
-- Normative source: data-model.md §3 (Art. V matrix)
-- Key invariant: an owner can NEVER read a patron's activity at
-- another business — structurally, not by application discipline.
-- ============================================================

-- ---------- Helper predicates ----------
-- The patron row belonging to the current JWT (following merges to the canonical row).
create or replace function current_patron_id() returns uuid
language sql stable security definer set search_path = public as $$
  with me as (
    select id, merged_into from patrons where auth_user_id = auth.uid()
  )
  select coalesce(merged_into, id) from me
$$;

-- Businesses owned by the current JWT.
create or replace function my_business_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from businesses where owner_user_id = auth.uid()
$$;

-- Admin claim check (role claim on the JWT).
create or replace function is_admin() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- ---------- Enable RLS everywhere ----------
alter table regions               enable row level security;
alter table towns                 enable row level security;
alter table seasons               enable row level security;
alter table businesses            enable row level security;
alter table subscriptions         enable row level security;
alter table perks                 enable row level security;
alter table check_in_codes        enable row level security;
alter table patrons               enable row level security;
alter table patron_devices        enable row level security;
alter table stamps                enable row level security;
alter table staff_entries         enable row level security;
alter table perk_redemptions      enable row level security;
alter table founding_picks        enable row level security;
alter table steer_impressions     enable row level security;
alter table regional_milestones   enable row level security;
alter table milestone_unlocks     enable row level security;
alter table wallet_pass_instances enable row level security;
alter table gate_thresholds       enable row level security;
alter table gate_metric_snapshots enable row level security;
alter table rotation_schedules    enable row level security;
alter table reprint_flags         enable row level security;

-- Art. II: stamps are never deleted — revoke the privilege outright (defense in depth
-- beneath RLS; not even a permissive future policy can re-enable deletes for app roles).
revoke delete on stamps from anon, authenticated;

-- ---------- Program structure: public read (patrons browse), admin write ----------
create policy regions_read  on regions  for select using (true);
create policy towns_read    on towns    for select using (true);
create policy seasons_read  on seasons  for select using (true);
create policy milestones_read on regional_milestones for select using (true);

create policy regions_admin on regions for all using (is_admin()) with check (is_admin());
create policy towns_admin   on towns   for all using (is_admin()) with check (is_admin());
create policy seasons_admin on seasons for all using (is_admin()) with check (is_admin());
create policy milestones_admin on regional_milestones for all using (is_admin()) with check (is_admin());

-- ---------- businesses: patrons see active only; owners own; admin all ----------
create policy businesses_public_read on businesses for select
  using (status = 'active' or owner_user_id = auth.uid() or is_admin());
create policy businesses_owner_update on businesses for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
create policy businesses_admin_all on businesses for all
  using (is_admin()) with check (is_admin());

-- ---------- perks: public read of active perks of active businesses; owner CRUD own ----------
create policy perks_public_read on perks for select
  using (
    (status = 'active' and business_id in (select id from businesses where status = 'active'))
    or business_id in (select my_business_ids())
    or is_admin()
  );
create policy perks_owner_write on perks for insert
  with check (business_id in (select my_business_ids()));
create policy perks_owner_update on perks for update
  using (business_id in (select my_business_ids()))
  with check (business_id in (select my_business_ids()));

-- ---------- check_in_codes: owner reads own; admin all; patrons NEVER (validation is in RPC) ----------
create policy codes_owner_read on check_in_codes for select
  using (business_id in (select my_business_ids()) or is_admin());
create policy codes_admin_write on check_in_codes for all
  using (is_admin()) with check (is_admin());

-- ---------- patrons / devices: self only; admin read ----------
create policy patrons_self on patrons for select
  using (auth_user_id = auth.uid() or id = current_patron_id() or is_admin());
create policy patrons_self_update on patrons for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
create policy devices_self on patron_devices for select
  using (patron_id = current_patron_id() or is_admin());
create policy devices_self_insert on patron_devices for insert
  with check (patron_id = current_patron_id());

-- ---------- stamps: THE Art. V boundary ----------
-- Patron: own rows. Owner: rows at THEIR business only. Admin: all.
-- Inserts happen ONLY inside security-definer RPCs (record_check_in / staff_check_in);
-- no direct insert policy exists for app roles — the trust model is the only door.
create policy stamps_patron_read on stamps for select
  using (patron_id = current_patron_id());
create policy stamps_owner_read on stamps for select
  using (business_id in (select my_business_ids()));
create policy stamps_admin_read on stamps for select
  using (is_admin());
-- Voiding (Art. II status flip) is admin-only, via the void_stamp RPC.
create policy stamps_admin_update on stamps for update
  using (is_admin()) with check (is_admin());

-- ---------- staff_entries: owner own-business; admin all ----------
create policy staff_entries_owner on staff_entries for select
  using (business_id in (select my_business_ids()) or is_admin());
create policy staff_entries_owner_insert on staff_entries for insert
  with check (business_id in (select my_business_ids()));

-- ---------- perk_redemptions: patron own; owner own-business; admin ----------
create policy redemptions_patron_read on perk_redemptions for select
  using (patron_id = current_patron_id());
create policy redemptions_owner_read on perk_redemptions for select
  using (business_id in (select my_business_ids()) or is_admin());

-- ---------- steer_impressions: patron inserts own (via RPC), reads own; admin reads ----------
create policy impressions_patron_insert on steer_impressions for insert
  with check (patron_id = current_patron_id());
create policy impressions_patron_read on steer_impressions for select
  using (patron_id = current_patron_id() or is_admin());

-- ---------- milestone_unlocks: patron own; admin ----------
create policy unlocks_patron_read on milestone_unlocks for select
  using (patron_id = current_patron_id() or is_admin());

-- ---------- wallet_pass_instances: patron own; admin ----------
create policy passes_patron on wallet_pass_instances for select
  using (patron_id = current_patron_id() or is_admin());
create policy passes_patron_write on wallet_pass_instances for insert
  with check (patron_id = current_patron_id());
create policy passes_patron_update on wallet_pass_instances for update
  using (patron_id = current_patron_id())
  with check (patron_id = current_patron_id());

-- ---------- founding_picks: public read; admin write (curated_by surfaces internally only via RPC shape) ----------
create policy picks_public_read on founding_picks for select using (true);
create policy picks_admin_write on founding_picks for all
  using (is_admin()) with check (is_admin());

-- ---------- subscriptions: owner reads own; admin reads; ONLY service-role writes (webhook) ----------
create policy subscriptions_owner_read on subscriptions for select
  using (business_id in (select my_business_ids()) or is_admin());
-- No insert/update policy for anon/authenticated: the Stripe webhook (service role,
-- bypasses RLS) is the single writer (R4, Art. XII/XV).

-- ---------- gates: admin only ----------
create policy gate_thresholds_admin on gate_thresholds for select using (is_admin());
create policy gate_snapshots_admin  on gate_metric_snapshots for select using (is_admin());

-- ---------- rotation_schedules / reprint_flags: owner read own; admin all ----------
create policy rotation_owner_read on rotation_schedules for select
  using (business_id in (select my_business_ids()) or is_admin());
create policy rotation_admin_write on rotation_schedules for all
  using (is_admin()) with check (is_admin());
create policy reprint_owner_read on reprint_flags for select
  using (business_id in (select my_business_ids()) or is_admin());
