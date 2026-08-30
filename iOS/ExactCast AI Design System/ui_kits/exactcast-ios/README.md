# ExactCast AI — iOS app UI kit

Four surfaces, iOS-only at launch. Fully click-through: the tab bar switches page, the location
pills and a **left/right swipe** move between saved locations, tapping the radar or forecast card
opens its page, the search button adds a location, and the gear opens settings.

| File | Surface |
| --- | --- |
| `index.html` | shell, fake data, routing, swipe handling, settings state |
| `AppChrome.jsx` | status bar, LocationBar (saved-location pills + search + settings), weather glyph, card header, wind arrow |
| `NowcastScreen.jsx` | **the main page** — conditional alert hero, conditions hero, radar preview, forecast preview |
| `RadarScreen.jsx` | full radar with play/scrub timeline, own-position ping, station pins |
| `ForecastScreen.jsx` | hourly detail strip, 14-day rows with layer switcher, source breakdown |
| `SettingsScreen.jsx` | language, text size, theme, saved-location management, AgroExact integration, model preferences, notifications |

## The main page, top to bottom
1. **Alert hero** — *conditional*. Rendered only when something significant is coming, and it is
   **not rain-only**: Westkapelle shows a wind alert with no precipitation at all, and Maastricht
   shows no hero because nothing is happening. The nowcast profile bars sit inside it.
2. **Conditions hero** — the chosen location's own measurements: now / high / low, condition glyph,
   wind + 24h precipitation + humidity, then the next three hours. Works for **any** address, not
   just station-backed ones (that is the Pro case).
3. **Radar card** → tap opens the Radar page.
4. **Forecast card** → hourly strip + first four days; tap opens Verwachting.

## Colour rule in this kit
Blue is weather. Green appears **only** where an AgroExact station is named — the
'\'s-Hertogenbosch' title and pill (station-backed), station map pins, the integration row.
Westkapelle and Maastricht are plain addresses, so their titles stay navy.

## Deliberately absent
'Actueel', 'Historisch' and 'Bodem' were removed at the client's direction. Onboarding and the
paywall are not in the sources, so they are not invented here.

## Fidelity notes
Layout of the conditions hero (▲/▼ pair beside the big reading, three-cell divider row, hourly rows
with per-measurand colours) follows `uploads/Schermafbeelding 2026-08-29 om 22.21.26.png` for
**information architecture only** — type, colour and shape come from this design system, per instruction.
