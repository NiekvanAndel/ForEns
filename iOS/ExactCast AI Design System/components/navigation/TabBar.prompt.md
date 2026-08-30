One-line: the app's only global nav — a floating liquid-glass capsule with side margins, never edge-to-edge and never a flat dark bar.

```jsx
<TabBar active={1} items={[{icon:'house',label:'Overzicht'},{icon:'cloud-sun',label:'Actueel'},{icon:'chart-line',label:'Historisch'},{icon:'broadcast',label:'Radar'},{icon:'plant',label:'Bodem'}]}/>
<TabBar appearance="dark" … />    {/* pin Dark Mode */}
<TabBar appearance="opaque" … />  {/* Reduce Transparency */}
```

- The default `appearance="system"` follows the iOS setting: the accent resolves through `--app-accent-current` (#2A628E light, #5FA3CE dark). Never hard-code the blue.
- Content must scroll *under* it — that's the point of the material. Keep ~130px bottom padding on the scroll view.
- The selected item switches to the filled weight of the same glyph, the standard iOS pairing.
- Five items maximum. Labels are single Dutch nouns.
