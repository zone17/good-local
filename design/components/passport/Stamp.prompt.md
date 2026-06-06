The visit token. Square-ish, double-rule, stamp-ink red — modeled on a real national-park passport stamp. Slight rotation gives it the human-stamped feel.

```jsx
<Stamp state="earned" label="BMR" date="06·14" />
<Stamp state="earned" label="HRN" date="06·14" just />   // just-stamped halo
<Stamp state="empty" />
<Stamp state="locked" />

<StampGrid
  total={5}
  columns={5}
  stamps={[
    { label: "BMR", date: "06·07", rotate: -4 },
    { label: "BMR", date: "06·12", rotate: 2 },
    { label: "BMR", date: "06·14", rotate: -2 },
  ]}
/>
```

Never use a circular ring or progress arc — this is a passport, not a fitness app.
