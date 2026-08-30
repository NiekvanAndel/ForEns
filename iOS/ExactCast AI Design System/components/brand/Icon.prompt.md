One-line: iOS-style icons (Phosphor) tinted with currentColor; a selected tab or active state uses the same glyph at `weight="fill"`.

```jsx
<Icon name="cloud-sun" size={22}/>                    {/* idle */}
<Icon name="cloud-sun" size={22} weight="fill"/>      {/* selected — iOS pairing */}
<Icon name="arrow-right" set="lucide" size={20}/>     {/* marketing site only */}
```

App tab bar: house, cloud-sun, chart-line, broadcast, plant. Never substitute emoji for an icon.
Send the real SF Symbols mapping and this component should point at those names instead.
