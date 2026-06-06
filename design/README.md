# Good Local Design System

A regional loyalty + discovery passport for the Upper Delaware river region (NY/PA).
This system serves three surfaces:

| Surface              | Audience                                   | Frame             |
| -------------------- | ------------------------------------------ | ----------------- |
| Patron mobile web    | NYC weekenders, river visitors, locals     | 390×844 (iPhone)  |
| Wallet pass          | Same — lock-screen + Wallet app            | 340×420 (PassKit) |
| Business dashboard   | Independent owner-operators                | 1280–1320 desktop |
| Printable QR kit     | Register-side print piece                  | US Letter         |

The product is described in full in
[`good-local/docs/prfaq-good-local.md`](../good-local/docs/prfaq-good-local.md)
(read-only mount).

The TLDR: patrons add an **Upper Delaware Passport** to Apple/Google Wallet from
a register QR (no app download), earn a stamp per visit, and unlock perks at the
businesses they frequent. Businesses pay $79/month for their own working rewards
program + a repeat-customer dashboard. Discovery ranks by **verified return
visits**, never by paid placement.

---

## Brand position

Heritage **national-park passport** crossed with a modern wallet pass. Warm,
outdoorsy, trustworthy — river towns, not Silicon Valley. The voice is plain
and person-to-person; the visuals are stamps, seals, paper, and river.

Explicitly avoid:

- corporate-loyalty energy (no coins, no confetti, no purple gradients)
- emoji in UI copy
- star ratings, fake stats, paid placement
- streak fitness-app tropes (visits are weekly-ish, not daily)
- the Good Vibes Coding cream-and-teal palette that styles the input docs —
  that is the **consultancy's** brand, not ours.

---

## Content fundamentals

### Voice

Plain, warm, person-to-person. The product talks **to** the patron and **about**
the business — never marketing-at-you. We are the bartender of a small-town bar
giving you advice, not a SaaS dashboard cheering you on.

- **You** speaking to the patron. **We** never refer to Good Local in the first
  person; the brand recedes once the patron is in.
- Owner-facing copy is direct and operational ("28 regulars this month, up 6")
  — no exclamation, no "unlock", no "exclusive".
- **No emoji.** Anywhere. Status icons are SVG. ✅ is not a thing here.
- **No ALL CAPS** beyond eyebrows and seal labels (3 words max each).
- Title case for nouns the user clicks (Add to Wallet); sentence case for
  everything else.
- Numbers are written out below 10 in prose ("two more visits"), digits in UI
  ("2 visits to go"). Mono digits in metric values.

### Tone exemplars

Patron, after check-in:

>  *Stamped at The Heron — Narrowsburg.*
>  *Mira left a note on this one. Two visits to the regular's pour.*

Patron, discovery list eyebrow:

>  *Three places people keep coming back to*
>  *Nearby · verified regulars · season 1*

Owner, dashboard weekly digest:

>  *28 regulars came in last week, up 6.*
>  *Your free-pour perk was redeemed 9 times — your highest yet.*

What we never say:

>  ~~Unlock exclusive rewards!~~
>  ~~Tap to claim your perk now!~~
>  ~~You're crushing it 🎉~~
>  ~~Loyalty unlocked!~~

### Copy patterns

- **Earned-stamp toast** — `Stamped at {Business}. {Remaining} {visits|town|badge} to go.`
- **Perk progress** — `You're {n} visits from {perk name}.`
- **Founding-pick eyebrow** — `Founding pick · {Town}`
- **Empty discovery state** — `Nobody's been a regular here yet. Be the first.`
- **Dashboard delta** — `{stat} this {week|month}, {↑↓} {delta}`

---

## Visual foundations

### Color

| Family            | Role                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| **Pine** (green)  | Primary. Wordmark, CTAs, brand surfaces, the wallet pass front.      |
| **Stamp ink**     | The "you earned it" red-brown. Stamps, danger, founding picks.       |
| **Ochre**         | Sun on water. Perks, secondary highlights, seal text on dark pass.   |
| **River**         | Slate-blue. Maps, info, alt wallet-pass tone.                        |
| **Paper**         | Backgrounds — warm cream, never pure white as page surface.          |
| **Ink**           | Warm-leaning neutrals. Body text, borders, hairlines.                |

All semantic pairings (`--text-*` on `--surface-*`) meet WCAG AA at 16px and
AAA on the primary body pair. Direct-sunlight outdoor use is the design
constraint, not a nice-to-have.

### Type

- **Newsreader** (display serif) — warm, editorial, optical sizing. Hero
  numbers, marketing headers, the wordmark. Acts as a heritage anchor.
- **Public Sans** (UI sans) — the US-government civic sans. Built for outdoor
  signage and screen reading at long sessions. Everything functional.
- **DM Mono** (numerics) — stamp counts, perk IDs, check-in codes.

16-px body floor; 14-px UI label minimum; 24-px minimum on slides and
business dashboards. Tabular-nums on every metric.

### Backgrounds, texture, illustration

- Pages: **warm cream** (`--paper-50`), never `#fff`.
- Secondary surfaces: **kraft** paper (`--paper-300`) — used as the back of the
  wallet pass, owner notes, and the printable QR kit.
- Texture: a single **river-curve watermark** on the wallet pass and the
  printable kit. No other photographic texture; no noise filter.
- Imagery is full-bleed, warm-toned, never blue-cold. Black-and-white is fine
  for documentary owner photography.
- No hand-drawn illustrations. No mascots. No gradients (one exception: the
  optional "lock-screen surfacing" subtle pine gradient, 700→900).

### Animation & states

- Motion is **short, competent, no bounces** — this is a register-side product.
- Three durations: `quick` 140ms (hover/fade), `base` 220ms (sheet/page),
  `stamp` 520ms (the check-in halo). That's it.
- Ease is custom `ease-stamp` with mild overshoot — only on the stamp halo.
  Everywhere else: linear `ease-out`.
- Hover = background tint darker by one step. Press = `translateY(1px)`.
- Disabled = 42% opacity, no other change.

### Shape, border, shadow

- **Heritage = less round (except the stamp).** Default radius is 10px;
  the wallet pass is 14px (mirrors PassKit). **Stamps are circular** —
  modeled on the real National Park Service passport-cancellation stamp
  (concentric rings, italic business code at center, arc text + date band).
  Each stamp is rotated −5° to ±4° so the grid feels hand-pressed, not vector.
- The canonical **wallet pass** is a deep **pine-leather passport cover** —
  gold-foil ochre accents, embossed perforations along the top edge, a round
  cream stamp debossed into the upper-right corner, italic display serif for
  the perk, big numeric stamp count. Variants: `pine` (default), `river`,
  `ink` (oxblood), `kraft` (warm-cream inside-page look).
- The **app icon** is the "Stamped Moment" — concentric ochre rings on a
  pine field with arced `GOOD · LOCAL` / `EST · 2026` and an italic G at
  center. The icon IS the moment of being stamped.
- Borders are **1.5px** on inputs, **1px hairline** on dividers, and **strong
  1.5px ink** for emphasized borders ("regulars only" notes).
- Shadows are warm-tinted (over warm ink, not blue) — they sit on cream paper
  without looking digital. Two stops: `card` (default raised), `lift` (drag),
  plus a special `pass` for the wallet pass.

### Transparency, blur, fixed elements

- Blur is reserved for **two places**: behind the just-stamped halo (4px), and
  the bottom-tab-bar veil on mobile (`backdrop-filter: blur(14px)` over a
  92%-opacity paper-50).
- Sticky elements: only the top nav (patron + dashboard) and the bottom
  tab bar on mobile.
- No glassmorphism elsewhere.

### Layout

- Mobile-first 4-px grid. Patron layouts cap at 560px wide.
- Dashboard caps at **1320px** with a 240px sidebar + 1080px content lane,
  designed for an iPad in landscape over the register.
- Print QR kit is US Letter, single-page, kraft + pine.

---

## Iconography

We use a **curated Lucide-style stroke set** embedded in
[`components/core/Icon.jsx`](components/core/Icon.jsx) — 2-px stroke, 24-px
viewbox, round cap/join. ~30 icons covering navigation, state, product (`qr`,
`wallet`, `map-pin`, `compass`), people, and a custom `stamp` glyph.

- **No emoji**, ever — including in marketing or owner-facing copy.
- **No icon fonts.** Stroke SVG only.
- **No filled / duotone variants.** Calm stroke is the brand.
- Lucide icons are ISC-licensed; if you need one not in the set, copy its path
  into `Icon.jsx` rather than reaching for a CDN. Patron flows must work on a
  weak rural cell signal.
- The four brand SVGs (`logo-horizontal`, `logo-wordmark`, `seal-mark`,
  `app-icon`, `stamp-impression`) live in [`assets/`](assets/) and have both
  pine and light variants where needed.

> **Substitution flag:** We are using **Newsreader**, **Public Sans**, and
> **DM Mono** from Google Fonts as the brand's primary type. Until the
> founder confirms an in-house type pick, these stand as the canonical
> stack. If a different display serif is chosen later (e.g. a licensed
> Plantin or Reforma), only `tokens/fonts.css` needs updating.

---

## File index

```
styles.css                       — entry. @import-only.
tokens/
  fonts.css                      — Google Fonts @import
  colors.css                     — pine, stamp, ochre, river, paper, ink + semantic
  typography.css                 — families, sizes, leading, tracking, html/body defaults
  spacing.css                    — 4px scale, radii, tap targets, pass geometry
  shadows.css                    — shadows, borders, motion
  components.css                 — gl-btn / gl-card / gl-stamp / etc base styles

assets/
  logo-horizontal.svg            — primary lockup (pine)
  logo-horizontal-light.svg      — same on dark
  logo-wordmark.svg              — wordmark only
  logo-wordmark-light.svg        — wordmark on dark
  seal-mark.svg                  — circular seal (currentColor)
  app-icon.svg                   — iOS / Android icon
  stamp-impression.svg           — decorative stamp motif

components/
  core/                          — Button, IconButton, Card, Badge, Tag, Icon,
                                   Field, Input, Textarea, Select, Switch,
                                   Tabs, Stat, Notice, Row, Divider
  passport/                      — Stamp, StampGrid, WalletPass, ProgressMeter,
                                   SealMark

ui_kits/
  patron/                        — mobile-web passport flow (check-in, wallet,
                                   home, discovery, business detail, me)
  business/                      — owner dashboard, perks + perk builder,
                                   regulars, printable QR kit, settings

guidelines/                      — foundation specimen cards (Design System tab)

readme.md                        — this file
SKILL.md                         — packaged Skill for Claude Code use
```

---

## Sources

- `good-local/docs/prfaq-good-local.md` — product PR/FAQ (v2, June 6 2026)
- `good-local/docs/discovery/00-discovery-brief.md` — adversarially verified bet
- `good-local/docs/discovery/01-04-*.md` — research synthesis, opportunity map,
  assumption tests, verification verdicts
- No Figma, screenshots or external codebase was provided. All visual decisions
  were made from the PRD voice + the brief's heritage-passport position.
