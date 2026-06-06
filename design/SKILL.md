---
name: good-local-design
description: Use this skill to generate well-branded interfaces and assets for Good Local — a regional loyalty + discovery passport for the Upper Delaware river region (NY/PA). Contains essential design guidelines (colors, type, fonts, motion, iconography), brand assets (logos, seal mark, app icon, stamp impression), and a React component library covering core UI primitives plus passport-domain components (Stamp, StampGrid, WalletPass, ProgressMeter, SealMark). Use for production code OR throwaway prototypes / mocks / slides.
user-invocable: true
---

# Good Local — Design Skill

Good Local is a community loyalty + discovery passport. Patrons add an
**Upper Delaware Passport** to Apple/Google Wallet from a QR at the register
(no app download), earn a stamp per visit, and unlock perks at the businesses
they frequent. Discovery ranks by **verified return visits**, never paid
placement. Businesses pay $79/month for their own working rewards program +
a calm repeat-customer dashboard.

## How to use this skill

1. **Read `readme.md`** first — it contains the brand position, content
   fundamentals (voice, tone, copy patterns), visual foundations (color, type,
   spacing, shape, motion), and iconography rules.
2. **Browse `guidelines/*.card.html`** for the foundation specimen cards.
3. **Browse `components/`** for the React component library:
   - `core/` — Button, IconButton, Card, Badge, Tag, Icon, Field, Input,
     Textarea, Select, Switch, Tabs, Stat, Notice, Row, Divider
   - `passport/` — Stamp, StampGrid, WalletPass, ProgressMeter, SealMark
4. **Open `ui_kits/patron/index.html`** and **`ui_kits/business/index.html`**
   to see the components composed into full surfaces.

## How to build things

- **For visual artifacts** (slides, mocks, throwaway prototypes): copy the
  assets from `assets/` and write static HTML files that `<link rel="stylesheet"
  href="styles.css">` and use the components either via the compiled bundle
  (`_ds_bundle.js`, exposing `window.GoodLocalDesignSystem_db344c`) or by
  hand-writing HTML with the `gl-*` CSS classes from `tokens/components.css`.
- **For production code**: copy `tokens/`, `assets/`, and the component
  sources you need. Replace the inline icon `<Icon>` paths with your existing
  icon system if you have one.

## Key reminders (do not let me deviate)

- **No emoji in UI copy.** Anywhere. Status icons are SVG.
- **No purple gradients, no coins, no confetti.** Heritage passport, not loyalty app.
- **Plain person-to-person voice.** "You're two visits from the regular's pour" —
  never "Unlock exclusive rewards!".
- **Warm cream backgrounds** (`--paper-50`), never pure `#fff` as page surface.
- **Pine green** (`--pine-700`) is the brand primary; **stamp ink** (`--stamp-700`)
  is the "you earned it" accent; **ochre** is sun; **river** is water.
- **Newsreader** display serif + **Public Sans** UI sans + **DM Mono** numerics.
- **44 px tap target floor; 52 px for outdoor / wet-hand actions; 64 px for the
  wallet CTA.** People use this in direct sunlight with wet hands.
- **Stamps are round** — modeled on a National Park Service passport
  cancellation stamp. Stamp-ink red, concentric rings, italic business
  code at center, slight hand-pressed rotation. Never circular progress
  rings (different element entirely).
- **The wallet pass is deep pine leather** with gold-foil ochre accents,
  a cream stamp debossed in the upper-right corner. Acts as the brand's
  hero surface.
- **App icon = Stamped Moment** — ochre concentric rings on pine, italic
  G at center.
- **No streaks** — visits are weekly-ish, not daily.
- **No star ratings, no paid placement.** Discovery ranking is verified return
  visits only.

## When invoked with no other guidance

Ask the user:

1. What surface are we designing — patron mobile, wallet pass, owner
   dashboard, printable QR kit, marketing site, slide deck?
2. Production code or throwaway / hi-fi prototype?
3. Do they want one polished output, or 2–3 variations to choose from?

Then act as an expert designer who outputs HTML artifacts or production code,
faithful to this brand.

## Inventory

- `readme.md` — design guide
- `styles.css` — entry, @import-only
- `tokens/` — fonts, colors, typography, spacing, shadows, components.css
- `assets/` — 7 brand SVGs (logo horizontal/wordmark/light variants, seal mark,
  app icon, stamp impression)
- `components/` — 21 React components
- `guidelines/` — 19 foundation specimen cards (Brand · Colors · Type · Spacing)
- `ui_kits/patron/` — 5-screen patron mobile-web flow
- `ui_kits/business/` — owner dashboard, perks, regulars, QR kit, settings
