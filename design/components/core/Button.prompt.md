The Good Local action button — use whenever the user needs to commit to something.

```jsx
<Button variant="primary">Add to Apple Wallet</Button>
<Button variant="secondary" leadingIcon={<Icon name="qrcode"/>}>Scan QR</Button>
<Button variant="wallet" size="lg" block>Add Upper Delaware Passport</Button>
```

Variants: `primary` (pine), `secondary` (paper with ink border), `ghost`, `danger` (stamp), `wallet` (the special ink-1000 PassKit CTA). Sizes: `sm` / default / `lg`. Pass `block` for full-width.

Tone of the label: plain, person-to-person. "Check in", "Save perk", "You're done", never "Submit" or "Unlock now".
