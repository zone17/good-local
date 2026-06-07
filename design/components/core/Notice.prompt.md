Inline notices, list rows, and dividers.

`<Notice>` — soft tinted callouts. Tones map to the four palettes (pine = default / success, ochre = warning, stamp = danger, river = info).

`<Row>` — mobile list item, 72px min height, optional avatar + trailing chevron.

```jsx
<Notice tone="ochre" title="Heads up">
  You changed the perk threshold from 5 to 6 visits.
</Notice>

<Row
  avatar={<Avatar name="Boomer's Diner" />}
  title="Boomer's Diner"
  sub="2 visits to a regular's coffee"
  trailing="›"
/>

<Divider dashed />
```
