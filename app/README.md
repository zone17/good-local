# Good Local — App

The production web app for Good Local: the **Upper Delaware Passport** (patron
mobile web) and the **business owner dashboard**, implementing the design
system at `../design` (the visual source of truth — vendored from the Claude
Design handoff, June 6, 2026).

## Run it

```bash
cd app
npm install
npm run dev      # http://localhost:5173
```

| Route | Surface |
|---|---|
| `/` | Patron mobile web — passport home, discover, check-in, me (≤560px lane) |
| `/c/:code` | Check-in entry — what the register QR encodes |
| `/business` | Owner dashboard — weekly note, perks + builder, regulars, QR kit, settings |

## Architecture

```
app/
  src/
    ds.js              — barrel re-exporting the 21 design-system components from ../design
    data.js            — MOCK data layer (the only place screens read data; swap for API)
    App.jsx            — two-surface path routing, no router dependency
    patron/PatronApp   — adapted from design/ui_kits/patron (visuals unchanged)
    business/BusinessApp — adapted from design/ui_kits/business (visuals unchanged)
design/                — design system: tokens, components, assets, guidelines (do not fork styles here)
```

Principles (from the design README + verified discovery brief):

- **Light pages** — react + react-dom only; weak rural cell signal is a launch constraint.
- **No emoji, no streak mechanics, no star ratings, no paid placement.**
- `design/` is canonical — visual changes happen there first, the app consumes them.

## What is mocked (June MVP wiring list)

- Check-in "scan" is a tap; real camera/QR + rotating-code validation (A13 trust model) pending.
- Wallet-add CTA is decorative; PassKit/Google Wallet issuance pending.
- All data ships from `src/data.js`; backend + auth pending (spec via /speckit flow).
