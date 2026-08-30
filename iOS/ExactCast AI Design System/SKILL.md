---
name: exactcast-design
description: Use this skill to generate well-branded interfaces and assets for ExactCast AI (consumer AI precipitation nowcasting, built on the AgroExact weather-station network), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for protoyping.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## What is where

- `readme.md` — the design guide: sources, content fundamentals (tone, Dutch je/jij register, honesty rules), visual foundations, iconography, and a file index. **Read this first.**
- `styles.css` — the single stylesheet to link. It is nothing but `@import` lines; everything it reaches ships to consumers.
- `tokens/` — the actual values: `colors.css` (incl. the colour rule below), `typography.css`, `spacing.css`, `shape.css`, `motion.css`, `fonts.css`.
- `components/<group>/` — 33 React primitives, one `<Name>.jsx` + `<Name>.d.ts` + `<Name>.prompt.md` each. Read the `.prompt.md` for when to use a component; read the `.d.ts` for its props.
- `ui_kits/exactcast-ios/` — the iOS app (Nowcast, Radar, Verwachting, Instellingen). Open `index.html`.
- `ui_kits/exactcast-web/` — the marketing site (Nowcast, Het netwerk, Prijzen). Open `index.html`.
- `guidelines/*.card.html` — small specimen cards; open them in a browser to see a foundation rendered.
- `_ds_bundle.js` — every component precompiled onto `window.ExactCastAIDesignSystem_6b62ae`. Load it with a plain `<script src>` in a prototype instead of transpiling the `.jsx` yourself.
- `uploads/` — the original client sources the whole system was transcribed from.

## Non-negotiable rules

1. **Blue is weather, green is AgroExact hardware.** Forecasts, readings, radar and app chrome are blue (`--sky`, `--accent`, `--accent-dark`). Green (`--agro*`) is correct *only* when the thing named is an AgroExact station — a station-backed location title, a station name, a map pin, the integration row. A weather word is never green; a station name is never blue.
2. **Reading colours follow the quantity, not the card**: `--val-high` ▲, `--val-low` ▼, `--val-temp`, `--val-precip`, and `--val-precip-zero` for a dimmed 0 mm.
3. **Never use `--muted-legacy`** (`#6D849E`) or the deprecated `--green-*` / `--status-red|amber|green` aliases in new work.
4. **There is no logo.** `assets/` is empty by design. Render the brand name in type (`components/brand/Wordmark.jsx`) where a mark would go. Never draw, reconstruct or approximate a logo.
5. **Buttons are always full pills** (`9999px`, `16px 28px`). Cards have **no borders** — they float on `--shadow-card`. Two coloured-border exceptions only: `Callout` (4px left) and `StatusCard` (5px top).
6. **Icons**: Phosphor for the iOS app (outline idle, `weight="fill"` when selected), Lucide for the marketing site. Never emoji in product UI, never a hand-drawn SVG.
7. **Copy is Dutch, informal je/jij**, sentence case, comma decimals (`1,6 mm`), dot thousands (`1.240`). State limits before benefits; mark unconfirmed facts rather than inventing them.

## Installing in Claude Code

Unzip this folder into your project (or your home config) as a skill directory:

```
.claude/skills/exactcast-design/     # project-local
~/.claude/skills/exactcast-design/   # available in every project
```

`SKILL.md` must sit at the root of that directory. Then invoke it by name, or just ask for ExactCast-branded work and Claude will pick it up.
