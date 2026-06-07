The pass itself. Mirrors PassKit geometry (340×420 @1×, 14-px radius). Use in three places: the check-in success screen, the lock-screen mock, and as the hero on the patron home.

The default look is a **deep pine-leather passport cover** — gold-foil accents, embossed perforations along the top edge, and a round debossed stamp pressed into the upper-right corner.

```jsx
<WalletPass
  businessName="The Heron"
  region="Narrowsburg, NY"
  count={3} total={5}
  perkLabel="The Regular's Pour"
  perkSub="Two more visits, on the house"
  stampCode="HRN"
  stampDate="06·14·2026"
  serial="UDP·NRWB·a7q9"
  expires="11·2026"
/>
```

Variants — `pine` (default · forest leather), `river` (slate-blue leather), `ink` (oxblood night), `kraft` (warm-cream inside-page look). Always pair with the seal mark; never use a logo on the wallet pass front. `stampCode` is auto-derived from `businessName` when omitted ("The Heron" → "HRN").
