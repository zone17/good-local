The circular passport seal — primary mark. Inherits color from CSS `currentColor` so it works on pine, paper, kraft, river, and ink surfaces without an asset variant.

```jsx
<SealMark size={96} style={{ color: 'var(--pine-700)' }} />
<SealMark size={72} topLine="HONESDALE · PA" bottomLine="VERIFIED · REGULAR" />
```

The optional `topLine` / `bottomLine` props let a business stamp a town-specific seal (e.g. "CALLICOON · NY").
