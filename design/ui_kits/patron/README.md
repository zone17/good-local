# Patron — Mobile-web UI kit

The patron-facing surface of Good Local. Mobile-web first (no app download);
the wallet pass lives in Apple/Google Wallet and is added directly from the
register QR.

## Screens included

- **Passport home** — hero wallet pass, current perk progress, your stamps
  grouped by business, regional 12-town progress.
- **Discover** — verified-regulars ranking, founding picks tab.
- **Check-in flow** — QR scan mock → stamped-success with halo animation →
  wallet-add sheet → "added" confirmation.
- **Business detail** — owner note, perk progress, your stamps for this place.
- **Me** — passport identity, stats, settings (lock-screen surfacing toggle).

## Try it

Open `index.html`. Use the sidebar nav (or 1/2/3/4 on the keyboard) to jump
between screens. The check-in screen's camera viewport is tappable — that runs
the scan → stamp halo → wallet-add flow.

## What's a mock

- The "scan" gesture is a tap, not a real camera.
- Geolocation and Wallet APIs are not wired — the wallet-add CTA is decorative.
- Stamp data is fixed in `PatronApp.jsx` under `MY_STAMPS` and `BUSINESSES`.

## Files

```
index.html        — device-frame shell, nav, mount
PatronApp.jsx     — all screens (Home, Discover, Checkin, BusinessDetail, Me)
README.md         — this file
```

All visuals come from the design system — components are imported from
`window.GoodLocalDesignSystem_db344c`. No new components are defined here;
this is composition only.
