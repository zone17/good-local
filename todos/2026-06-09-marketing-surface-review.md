# Marketing surface review — 2026-06-09

Four-lens review (correctness, security, a11y/UX, performance) of the landing +
blog + podcast + admin-authoring surface (PRs #12–#15). Findings below.

## Fixed in this pass (PR: review-fixes)
- **P1 routing** — unanchored `startsWith` prefixes (`/app` matched `/apple`, etc.). Now matched exactly or as `/seg/` subpaths via `at()`. `App.jsx`
- **P1 markdown** — `# Title\ntext` dropped everything after the heading line. Heading match now requires a single-line block. `useContent.js`
- **P1 a11y** — landing hero had no `<h1>` (all headings were `<h2>`). `Display` gained an `as` prop; hero is now `<h1>`. `Landing.jsx`
- **P1 a11y** — mobile burger missing `aria-expanded`/`aria-controls`; added + dynamic label + `id` on the panel. `Chrome.jsx`
- **P2 authoring** — editing + changing a slug inserted a duplicate row (upsert keyed on slug). Now upserts on `id` when editing. `published_at` is cleared on unpublish and re-stamped only on a true publish transition. `episode_number` validated as integer. URL fields rejected unless `http(s)`. `key={table}` resets editor state on blog↔podcast switch. `AdminApp.jsx`
- **P2 security** — podcast `<iframe>` now `sandbox`ed with a narrowed `allow`; Apple/Spotify links got `noreferrer`. `Podcast.jsx`
- **P2 perf** — blog cover image reserves its box (`aspect-ratio` + `objectFit` + `decoding=async`) to kill CLS. `Blog.jsx`
- **P2 perf** — content hooks got `active`-flag cleanup (no setState-after-unmount, no stale-slug race). `useContent.js`
- Verified NOT a problem: `ink-500` (#6E665A) on paper-50 ≈ 5.3:1 → passes AA. RLS write-gate (`is_admin()` only, anon cannot read drafts) is sound. Markdown renderer is XSS-safe (escape-first + http(s)-only links).

## Deferred (do next)

### P1 perf — Supabase client ships in the main entry
`App.jsx` statically imports `lib/auth.js` → `@supabase/supabase-js` (~40–50KB gz)
lands in the main bundle, so the **landing page (most-hit route) downloads the
whole auth/realtime/postgrest client it never uses**. Main entry is 100.8KB gz
(budget 130) so not breaking the gate, but it's dead weight on first paint.
**Fix:** move the Supabase client behind a lazy boundary — extract `AdminRoute`
(the only eager `supabase`/`getRole`/`signInOwner` user in `App.jsx`) into a lazy
chunk, or lazy-import `auth.js` inside it. Verify the landing chunk no longer
contains Supabase via a bundle visualizer. Highest-leverage perf win.

### P2 — content fetch error state is indistinguishable from empty
`useContent.js` maps a failed fetch (network/RLS error → `data: null`) to the
empty state ("First post coming soon"). Add an `errored` flag and surface a
quiet retry, or at least `console.warn` the error.

### P2 a11y — mobile menu focus management
No focus move into the menu on open, no return-focus to the burger on close, no
Escape-to-close, and an open menu can be stranded if the viewport crosses 760px.
Add Escape handling, return focus on close, and close on resize past the bp.

### P3 perf — font-display + preconnect
Confirm `@ds` font faces use `font-display: swap`; add `<link rel="preconnect">`
for the font origin and `crossorigin` preconnect for the Supabase URL so blog/
podcast fetches start their handshake earlier. Hero LCP is text, so this guards
against FOIT.

### P3 — verify DS barrel tree-shaking
Confirm the Landing chunk doesn't drag unused DS primitives (Tabs/Input/StampGrid)
via the `ds.js` barrel. If it does, import primitives directly or mark
`sideEffects: false`.

### P3 — misc
- `markdown` `_italic_` is greedy across `snake_case` words; consider word-boundary anchors or switch to `*italic*`. URLs with literal `)` are truncated.
- Narrow viewport (~320px): hero `WalletPass` is a fixed 300px; cap with `max-width: 100%`.
- Add explicit `:focus-visible` styling audit across nav/card links.
