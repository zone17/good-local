2-px stroke, 24-px viewbox, round cap/join — Lucide-style. Curated set; 30+ icons covering navigation, state, product (qr, wallet, map-pin), people, and a custom "stamp".

```jsx
<Icon name="qr" size={20} />
<Icon name="wallet" size={24} strokeWidth={1.75} style={{ color: 'var(--pine-700)' }} />
```

For decorative icons in headers, set `style={{ color: 'currentColor' }}` and let the parent control color. For status icons (alert, info), the parent applies tone via wrapping color.

Need a new icon? Add its path to `Icon.jsx` rather than reaching for emoji or a CDN.
