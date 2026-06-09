-- ============================================================
-- 0016_content_blog_podcast.sql — marketing content (D-025).
--
-- Two CMS-style tables backing the public /blog and /podcast pages, authored
-- from the existing /admin portal (no external CMS). RLS:
--   - anon/authenticated may SELECT only PUBLISHED rows (public reads).
--   - admins (is_admin()) have full read/write (authoring).
-- The audio for episodes lives on an external podcast host; we store the
-- embed/listen URLs only.
-- ============================================================

create table if not exists blog_posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  excerpt      text,
  body         text not null default '',            -- markdown
  cover_image_url text,
  author       text not null default 'Good Local',
  status       text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index blog_posts_published on blog_posts (published_at desc) where status = 'published';

create table if not exists podcast_episodes (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  episode_number int,
  title          text not null,
  guest          text,                              -- the business owner featured
  description    text,
  audio_embed_url text,                             -- Spotify/Apple/Transistor embed src
  apple_url      text,
  spotify_url    text,
  duration       text,                              -- e.g. "38 min"
  status         text not null default 'draft' check (status in ('draft','published')),
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index podcast_published on podcast_episodes (published_at desc) where status = 'published';

-- ---------- RLS ----------
alter table blog_posts       enable row level security;
alter table podcast_episodes enable row level security;

-- Public: read published rows only.
create policy blog_public_read on blog_posts
  for select using (status = 'published');
create policy podcast_public_read on podcast_episodes
  for select using (status = 'published');

-- Admin: full access (authoring from /admin). is_admin() defined in 0002_rls.
create policy blog_admin_all on blog_posts
  for all using (is_admin()) with check (is_admin());
create policy podcast_admin_all on podcast_episodes
  for all using (is_admin()) with check (is_admin());

grant select on blog_posts, podcast_episodes to anon, authenticated;
grant insert, update, delete on blog_posts, podcast_episodes to authenticated;

-- keep updated_at fresh
create or replace function touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger blog_touch    before update on blog_posts       for each row execute function touch_updated_at();
create trigger podcast_touch before update on podcast_episodes for each row execute function touch_updated_at();

-- ---------- Seed: one published post + one episode so the pages aren't empty ----------
insert into blog_posts (slug, title, excerpt, body, author, status, published_at)
values (
  'welcome-to-the-river',
  'Welcome to the river',
  'Good Local is live across the Upper Delaware — here''s what we''re building and why.',
  $md$The Upper Delaware is twelve towns that share one river and a hundred small
places worth coming back to. **Good Local** ties them together with a single
passport: a stamp every time you visit, perks at the spots you love, and honest
discovery that can never be bought.

This season is our first. We're onboarding founding businesses, and every week
we'll share what's new on the river — a fresh spot, a season milestone, the
people behind the counters.

Walk into any participating place, scan the QR by the register, and your first
stamp lands. No app to download. See you out there.$md$,
  'Good Local',
  'published',
  now()
)
on conflict (slug) do nothing;

insert into podcast_episodes (slug, episode_number, title, guest, description, duration, status, published_at)
values (
  'ep-1-the-heron',
  1,
  'Saving your fifth — Mira at The Heron',
  'Mira Eisen, The Heron (Narrowsburg)',
  'Our first episode: Mira on opening a river-view restaurant, what makes a regular, and why she leaves a note on every fifth visit.',
  '34 min',
  'published',
  now()
)
on conflict (slug) do nothing;
