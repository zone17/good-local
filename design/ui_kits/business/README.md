# Business — Owner dashboard UI kit

The product the owner-operator pays $79/mo for. Tablet/desktop-web.

> Designed to be readable in a 30-second glance between customers — one
> number that matters per panel, with a plain-language read above it.

## Views included

- **This week** (dashboard) — weekly note hero, four-stat row (repeat-visit
  rate, regulars, new patrons, redemptions), perk performance, visit pattern
  bar chart, recent activity feed.
- **Perks** — perk cards with active/off state, redemption progress, plus the
  modal **perk builder** ("design a perk in 2 minutes") with live wallet-pass
  preview.
- **Regulars** — the privacy-promising patron table. Aggregate only — never
  cross-business history.
- **QR kit** — printable register card preview + staff-entered fallback for
  patrons who can't scan.
- **Settings** — profile, plan ($79 → optional $49 winter), privacy toggles.

## Try it

Open `index.html`. Use the left sidebar to navigate. The top-bar "New perk"
button opens the perk builder; the four perk cards also have edit icons.

## Files

```
index.html         — shell + mount
BusinessApp.jsx    — all views + sidebar/top bar + perk builder
README.md          — this file
```

All visuals come from the design system bundle.
