A flat, horizontal progress bar — the perk meter. Pair with a Stamp grid for the visual, with this for the headline number.

```jsx
<ProgressMeter
  count={3} total={5}
  label="The Regular's Pour"
  remainingLabel="2 visits to go"
/>
```

Never use this for time-based (streaks) progress. Visits are weekly-ish; we count, not time.
