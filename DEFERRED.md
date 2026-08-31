# Deferred work

Decisions made during the build that are deliberately postponed. Each one is a
choice already taken, not an open question — the note records what was agreed and
what has to change when it is picked up.

## Weather icons: move to native SF Symbols, light and dark

**Agreed 2026-08-31. To be done in the final polish phase.**

The app currently draws weather conditions with Phosphor
(`ui/WeatherIcon.tsx`), following the design system's rule 6. The client wants the
original Swift/SF Symbols set instead, with proper light and dark variants — SF
Symbols carries a far richer weather vocabulary than Phosphor and renders natively
in both appearances, including the multicolour and hierarchical rendering modes.

What this touches:

- `ui/WeatherIcon.tsx` — the `Condition` union and `CONDITION_ICON` map. Swap the
  Phosphor component for `expo-symbols` (`SymbolView`), keeping `wmoToCondition`
  exactly as it is: the WMO mapping is the tested part and does not change.
- `wmoToCondition` currently collapses distinctions Phosphor cannot draw (light vs
  heavy drizzle both become `drizzle`). SF Symbols *can* draw them
  (`cloud.drizzle`, `cloud.heavyrain`, `cloud.sun.rain`, `cloud.bolt.rain`, …), so
  the condition union should be widened back out toward the 21 WMO codes
  `index.html` distinguishes rather than kept at Phosphor's resolution.
- Day/night: SF Symbols has explicit `.moon` variants, so `isDay` should select
  the variant rather than only tinting it, as it does now.
- Rendering mode: prefer `palette` or `multicolor` so the glyphs read as weather
  rather than as monochrome UI icons; the tint-by-daylight rule in the current
  component was a Phosphor workaround and can be dropped.
- This is a deliberate deviation from design rule 6 ("Phosphor for the iOS app").
  Phosphor stays for every non-weather icon; only the condition glyph changes.
- The widget target (SwiftUI) should use the same SF Symbols names, which is a
  side benefit — the app and widget currently cannot share an icon vocabulary.

`expo-symbols` requires no extra native setup beyond being installed.
