# ExactCast AI — Design System

**ExactCast AI** is a consumer weather app: AI *precipitation nowcasting* — where and when it will
rain in the next two hours — sharpened by the real measurements of the **AgroExact** weather-station
network. The pitch is not "another forecast" but "a forecast built on a rain gauge near your street
instead of a model over your province". Launch is **iOS only**; Android is acknowledged as later,
without a date.

It inherits AgroExact's visual identity wholesale: cream paper, navy panels, one green accent,
Figtree, pill buttons, borderless cards floating on a single soft shadow.

## Sources this system was built from

| Source | What was taken |
| --- | --- |
| `uploads/agroexact-lokaal-weer-voorbeeld.html` | **Ground truth for the web side.** A full AgroExact page with an inline token block ("uitgelezen uit de live site agroexact.com"). Every colour, radius, shadow, font size and spacing value in `tokens/` is transcribed literally from it, including the deliberate contrast fix on `--muted`. |
| `uploads/Schermafbeelding 2026-08-29 om 22.21.26.png` | **Information architecture for the main page**: the ▲/▼ pair beside the big reading, the three-cell wind / 24h precipitation / humidity divider row, per-measurand colouring of the hourly rows, the 14-day min→max range bars, and the location pills. Supplied explicitly as an IA reference, *not* for type, colour or shape. |
| `uploads/Schermafbeelding 2026-08-29 om 20.52.12.png` | **Earlier app screenshot.** The existing AgroExact iOS "Actueel" screen: metric-card grid, 24px card radius, location pills, floating dark tab bar, cool/warm value colours. |
| Brief notes in chat | Confirmed the token values, the 135°/160° gradient angles and the harder mobile rounding. |
| `agroexact.com` (referenced, not accessible) | The uploaded page hot-links `/images/Agroexact-logo-Donkerblauw-1.png` and `/images/rijden.jpg`. No binaries were provided, so `assets/` is empty by design. |

No Figma file, repository or design-system definition was supplied. **No logo exists in this system**
— the brand is set in type (`components/brand/Wordmark.jsx`) and nothing was redrawn from memory. The mark is accented in the cool precipitation blue, **not** green: and green is no longer a brand colour at all — it reads as agriculture, which this consumer app is not.

## Products

1. **ExactCast iOS app** (`ui_kits/exactcast-ios/`) — four surfaces only: **Nowcast** (the main page),
   **Radar**, **Verwachting**, and **Instellingen** (reached by the button beside the search field).
   Every screen carries the location bar; a left/right swipe moves between saved locations.
   The main page stacks a *conditional* alert hero (any significant weather — rain, wind, storm — and
   nothing at all when the weather is quiet), then the chosen location's own measurements, then a radar
   card and a forecast card that open their pages. 'Actueel', 'Historisch' and 'Bodem' were removed at
   the client's direction.
2. **ExactCast marketing site** (`ui_kits/exactcast-web/`) — Nowcast (home), Het netwerk, Prijzen.

---

## CONTENT FUNDAMENTALS

**Language.** Dutch, informal **je/jij** — never *u*. The reader is addressed directly and constantly:
*"Weet wat er op jouw perceel is gevallen"*, *"Kan ik het land op?"*. The brand speaks as **we**
sparingly and only about its own actions (*"we delen jouw meetgegevens niet"*); it never says "wij bij
ExactCast vinden…".

**Register: plain, concrete, slightly dry.** Nouns are physical (paal, perceel, regenmeter, straat),
verbs are everyday. No superlatives, no "revolutionair", no "krachtig platform". Where a term could be
jargon, it gets its own explanation block: *"Wat is een 'meetpunt' en wat is een 'medewerker'?"* — this
is a house pattern, not a one-off.

**Radical honesty is the tone of voice.** The source page contains an entire section titled
*"Wat de RainExact níét zelf meet"* that un-asterisks a marketing asterisk, and inline amber badges
reading *te bevestigen* / *gegevens ophalen* on facts not yet verified. Carry that over: state limits
before benefits (*"na twee uur neemt de onzekerheid snel toe"*), show the uncertainty percentage, mark
unconfirmed numbers rather than inventing them.

**Headlines are contrasts, not slogans.** The pattern is *X, niet Y*, with the "X" half carrying a
green-coloured span:
- *"Weet wat er op **jouw perceel** is gevallen, niet op het vliegveld"*
- *"Weet of het bij **jouw straat** gaat regenen, niet bij het vliegveld"*
- *"Radar vertelt waar de bui is. Stations vertellen wat er echt viel."*

**Section openers are questions the user actually asks.** *"Kan ik het land op?"*, *"Mag ik spuiten?"*,
*"Waar begin ik vandaag?"* → for consumers: *"Kan de was buiten?"*, *"Haal ik het op de fiets?"*.
FAQ questions are written in the user's own words, answered in two or three sentences maximum.

**Casing.** Sentence case everywhere — headings, buttons, nav, card titles. The only uppercase is the
eyebrow, and that is done in CSS, so the source text stays sentence case. Product names keep their
internal caps: RainExact, AtmoExact, ExactCast AI.

**Numbers.** Dutch conventions, always: comma decimals (**1,6 mm**, **23,1 °C**), dot thousands
(**1.240**), space before the unit, euro with a comma (**€3,99**). Amounts always state the period and
the tax basis (*"per jaar en exclusief btw"*, *"per maand, inclusief btw"*). A missing reading is an
en-dash **–**, never 0 and never hidden. Measurement heights are named because they matter:
*"op 1,5 m (WMO-meethoogte)"*.

**Buttons and links** are verb phrases in the user's voice: *"Kijk wie er bij jou in de buurt meet"*,
*"Reken het door"*, *"Stel je pakket samen"*. Never *"Meer informatie"* or *"Klik hier"*.

**Emoji.** Not in product UI. The one inherited exception is flag glyphs in the language switcher
(🇳🇱 ▾) and the footer language list. Do not extend this — no emoji in cards, headings or buttons.

**Vibe.** A well-organised Dutch farm office: practical, unhurried, allergic to hype, quietly proud of
measuring things properly. The app talks to a consumer the same way, just about laundry and bike rides
instead of hectares.

---

## VISUAL FOUNDATIONS

**Colour.** Warm cream paper (`#F4EEE3`) with a lighter cream (`#FBF8F3`) for alternating sections;
cards are **pure white**, which is what makes them read as objects on paper. Text is a navy family:
`#1F3354` body, `#0C2547` headings, `#4F6885` muted (already contrast-corrected to 4.9:1 — the
lighter `#6D849E` is kept in the tokens only as a deprecation marker; never use it). One accent:
green `#7BB570` / `#5C9452`. Deep navy `#0A1936`/`#091C3D` for hero and dark panels. Status is rainfall, so it is
**one ramp rather than a traffic light**: cream `#F4EEE3` dry → fresh light blue `#5FD0F2`
light/uncertain → deep blue `#12557E` heavy. Fills are for shapes; text uses the `-ink` variants, and the cream step
carries a hairline so it survives on white. Colour never carries meaning alone; the amber gets a darker text variant (`#C8801F`) when it must sit on white. Maximum two
background colours per page: cream and cream-2, plus navy for hero/footer.

**Gradients** are structural, not decorative, and there are exactly three:
135° blue (primary buttons, numbered step circles, the "own column" table header), 160° navy
(hero, dark result panels), 135° `#4A8CBC → #255878` (the closing CTA band). On top of navy sits a
single 200° 5%-white diagonal wash (`--gradient-sheen`) — the only ornament allowed on dark.
No bluish-purple gradients. No mesh, no glow.

**Type.** Figtree throughout, 16px/1.5 base. Headings 600 (never 700, never 300): 40/1.3, 32/1.25,
20/1.35. Leads 17/1.625 in muted. Eyebrows 13px/700 uppercase, 0.14em tracking, green-dark. Values and
prices 700. Weight 800 is reserved for the wordmark. Italic appears only inside a `<q>`.

**Shape.** 16px on web cards, 10–12px on fields and small tiles, **24px on iOS metric cards** (the app
rounds harder), 28px on the CTA band, and full pills (9999px) on every button, every location pill and
the tab bar. Buttons are always `16px 28px` (or `12px 24px` small) — a rounded rectangle button is
off-brand. Dark heroes end in a `0 0 40px 40px` radius, cutting the navy off the page like a card.

**Depth.** One shadow does almost all the work: `0 18px 50px -24px rgba(9,28,61,.28)` — large, soft,
low-opacity, cast downward. **Cards have no borders.** Hairlines (`rgba(12,37,71,.07–.09`) appear only
*inside* a card to divide rows or columns. Two extra shadows exist: a small float
(`0 4px 14px rgba(0,0,0,.13)`) for map legends and pills over imagery, and a deep phone shadow
(`0 30px 70px -30px rgba(0,0,0,.75)`). No inner shadows anywhere.

**Backgrounds & imagery.** Flat cream, no textures, no patterns, no illustrations. Photography is
documentary and warm — daylight fieldwork, no filters, no black and white, no grain — and cropped into
a 16px-radius card. Maps are drawn from flat geo colours (`--map-land-*`, `--map-water`) with a
44px white grid, never a satellite photo. The system contains **no hand-drawn SVG illustrations**, and
new ones should not be invented.

**Accent borders — the two allowed exceptions.** A 4px accent **left** border marks an explanatory or
honest-caveat card (`Callout`); a 5px **top** border from the precipitation ramp marks a rain-state legend card
(`StatusCard`). Outside those two components, coloured borders are off-brand.

**Motion.** Everything transitions in **0.18s** ease, and there are only four gestures:
primary buttons brighten (`brightness(1.06)`) and lift 1px; ghost buttons raise their border opacity
(.2 → .45 on light, .35 → .7 on dark); link arrows slide 4px right; disclosure markers rotate 90°.
There is **no press state that shrinks**, no bounce, no spring, no scroll-reveal animation. The single
looping animation in the whole system is the 2.4s expanding ring on the "you are here" map pin.

**Transparency & blur.** Three places, and all three are materials rather than colours: the fixed site
header (`rgba(10,25,54,.71)` + `blur(10px)`, so content scrolls under a navy scrim); the app's
**liquid-glass tab bar** (58% white tint over `blur(24px) saturate(180%)`, a 1px inner top highlight
and a soft outer shadow, so the cream page and the radar map read through it — it follows the iOS
appearance setting, with a dark set for Dark Mode and a 94%-opaque no-blur fallback for Reduce
Transparency, and it is **not** a flat dark bar). The app's interactive accent is a deep blue that is
**appearance-linked, never hard-coded**: read `--app-accent-current`, which resolves to `#2A628E` in
Light and `#5FA3CE` in Dark through `prefers-color-scheme`, or is pinned per screen with
`[data-appearance]` when the user overrides the OS inside the app; and map overlay chips (`rgba(255,255,255,.94)`, no blur). Text over navy is white at four fixed opacities
(.9 / .82 / .75 / .6) rather than grey. Protection gradients are not used — overlays are opaque
capsules instead, which is why map labels are white pills, not gradient scrims.

**Focus & fields.** Inputs carry a 1.5px `rgba(12,37,71,.15)` border and switch to the accent with a 3px
`rgba(60,126,176,.22)` ring on focus. Focus is always the brand accent blue at 22% — never the browser blue.

**Layout.** 1280px max width, 32px gutter (20px on mobile), sections 112px tall (72px mobile), grid
gaps of 24px between cards and 14–20px between tiles. Two fixed elements exist: the 80px translucent
site header, and the app's floating glass tab bar, which keeps 16px side margins and 22px from the bottom —
never edge-to-edge, with ~130px of bottom padding on the scroll view so content passes under it. The trust bar deliberately overlaps the hero by −44px; that overlap is a signature,
not an accident.

---

## ICONOGRAPHY

**Two sets, split by platform — because the platforms have different conventions.**

**iOS app → Phosphor Icons, as an SF Symbols stand-in.** iOS is the launch platform, so the app
follows Apple's icon conventions: one glyph per tab, **outline when idle and the filled twin when
selected**, tinted with `currentColor`, 22–26px. Apple's SF Symbols cannot be redistributed or
CDN-linked, so Phosphor is used: rounded caps, even optical weight, and the same regular/fill pairing.
**Flagged substitution** — send an SF Symbols name mapping (or your own iOS asset catalogue) and
`components/brand/Icon.jsx` should point at those names instead.

- Tab bar: `house`, `cloud-sun`, `chart-line`, `broadcast`, `plant` — matching the five tabs in the
  supplied screenshot (Overzicht, Actueel, Historisch, Radar, Bodem).
- In-app: `cloud-rain`, `drop`, `wind`, `thermometer-simple`, `bell`, `map-pin`, `gear`,
  `arrows-clockwise`.
- Status bar glyphs in the kit (`cell-signal-full`, `wifi-high`) are mock chrome, not product icons.

**Marketing site → Lucide, kept verbatim.** This is observed, not assumed: the source page embeds raw
Lucide path data (`phone` and `arrow-right` are byte-for-byte Lucide), stroke 2.2–2.5, round caps,
17–20px inline. Use `<Icon set="lucide" …>` there so the web keeps the geometry it already ships.

**Everything else about iconography:**
- **No icon font, no sprite sheet, no PNG icons** exist in the sources; nothing is hand-drawn here.
  Both sets load as SVGs from pinned CDNs and are tinted through a CSS mask so `currentColor` applies.
- **Unicode as icon:** two inherited cases — an accent-blue **✓** for plan features, and **+ / –** (not a
  chevron) for accordion state. The "no value" mark is an en-dash **–**.
- **Emoji:** never in product UI. Flag emoji in the site's language switcher is the only inherited
  exception; do not extend it.
- **Never** hand-draw an SVG illustration or approximate a logo to fill a gap; leave the space blank
  and note it.

### Intentional additions
Everything else maps to something in the sources. Two components have no direct counterpart and were
added deliberately:
- **`Icon`** — one wrapper over both sets (iOS-style Phosphor by default, Lucide for the web); without
  it every consumer would paste raw paths and the platforms would drift.
- **`Wordmark`** — a typographic stand-in because no logo file exists, accented in the brand blue. Replace it, don't extend it.

---

## Index

| Path | What's there |
| --- | --- |
| `styles.css` | the one file consumers link — `@import` list only |
| `tokens/colors.css` | surfaces, ink, blue accent (+ deprecated green aliases), navy, on-navy opacities, status triplet, app palette + liquid-glass material, hairlines, map, semantic aliases |
| `tokens/typography.css` | Figtree scale, line heights, weights, tracking |
| `tokens/spacing.css` | 4→56 scale, section rhythm, max width, gutters, component paddings |
| `tokens/shape.css` | radii (incl. app 24px), the three shadows, blur, border widths |
| `tokens/motion.css` | 0.18s duration, hover transforms, `ec-pulse` keyframes |
| `tokens/fonts.css` | Figtree from Google Fonts + font-family aliases |
| `guidelines/*.card.html` | 21 foundation specimen cards (colour cards cover the blue accent + precipitation ramp) (Colors, Type, Shape, Spacing, Motion, Brand) — incl. the iOS icon specimen |
| `components/core/` | Button, LinkArrow, Card, Eyebrow, SectionHeading, Badge |
| `components/forms/` | Input, Select, Field |
| `components/data/` | MetricCard, StatTile, StatusDot, MeasurementRow, ResultRow, MeterBar, ScaleBar, ComparisonTable |
| `components/feedback/` | Callout, StatusCard, WarnBox, Accordion |
| `components/navigation/` | SiteHeader, SiteFooter, PillTabs, TabBar |
| `components/marketing/` | TrustBar, PlanCard, SpecCard, Testimonial, CtaBand, PhoneMock |
| `components/brand/` | Wordmark (placeholder), Icon (Phosphor for iOS / Lucide for web) |
| `ui_kits/exactcast-ios/` | four-surface click-through iOS app (Nowcast · Radar · Verwachting · Instellingen) |
| `ui_kits/exactcast-web/` | three-page click-through marketing site |
| `assets/` | empty — see `assets/README.md` for exactly what to send |
| `guidelines/colors-values.card.html` | the high/low + per-measurand reading colours |
| `SKILL.md` | Agent-Skills entry point for use outside this project |

No slide template was supplied, so this system contains no slide deck.
