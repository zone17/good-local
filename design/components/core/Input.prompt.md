Form primitives — `<Field>` wraps any of `<Input/Textarea/Select>` with a label, hint and error.

```jsx
<Field label="Phone (for the staff-entered path)" hint="We text you a one-time link.">
  <Input type="tel" placeholder="(845) 555-0142" />
</Field>

<Field label="Perk name" error="That perk title is already in use.">
  <Input defaultValue="The Regular's Pour" />
</Field>

<Switch checked={on} onChange={setOn} label="Lock-screen surfacing" />
```
