# Deferred work and known gaps

Decisions taken during the build that are postponed, and limitations that are real
rather than bugs. Each entry records what was agreed or what the constraint is.

## Done

### Weather icons: native SF Symbols, light and dark — **completed**

Agreed 2026-08-31, implemented in the final phase. `ui/WeatherIcon.tsx` now uses
`expo-symbols`, and `core/model/conditions.ts` maps the full WMO set — including the
drizzle / rain / heavy-rain and shower / steady-rain distinctions Phosphor could not
draw. Day and night are separate symbols rather than a tint. Phosphor remains for
every non-weather icon, so this is a scoped deviation from design rule 6. The SwiftUI
widget reads the same mapping, so the two cannot disagree.

---

## Hidden pending a decision

Four surfaces are built, tested and working, but **not shown in the UI** at the
client's direction (31 Aug 2026). Each is hidden rather than deleted: preferences,
plumbing and tests all remain, so re-exposing one means restoring its rows in
`app/(tabs)/settings.tsx`.

| Hidden | Where the code still lives | Why |
| --- | --- | --- |
| **Meldingen** (rain / wind / frost / quiet hours) | `core/notifications.ts`, `core/backgroundTask.ts` | To be worked out later — see the push limitation below |
| **Korte termijn: Nowcast / Radar** | `prefs.shortModel` | Needs a second 0–2h source to choose between |
| **AgroExact integration** | `core/sources/agroexact.ts`, `state/stations.ts` | To be done later |
| ~~App and widget icon~~ | ~~—~~ | **Done** — see `logos/README.md` |

The background task still runs and still keeps the widget current; it simply
schedules no notifications while every notify preference is off, which is the
default.

## Notes on choices made during the August rework

### The current hour is a ring on dark, a wash on light

The design fills the current hour's cell with `--sky-wash`. Inverted onto navy that
becomes the brightest thing on screen, so on dark it is drawn as a light-blue ring
around an otherwise unfilled cell. Light keeps the design's wash. If you would rather
have the ring in both appearances, `ui/forecast/currentHour.ts` is the only file to
change.

### Swiping to change location wraps around

A swipe past the last saved location returns to the first, as a carousel does, rather
than stopping. The dots in the top bar show where you are. Say if you would prefer it
to stop at the ends.

### `~` marks an ensemble stand-in

Where the deterministic IFS run falls outside the ensemble band, the ensemble median
is shown instead and marked with a small `~`, exactly as `index.html` does. It appears
on the overview rows and in the day sheet.

## Open

### Notifications are local, not push

`core/notifications.ts` schedules **local** notifications from the forecast the device
already holds, refreshed by `core/backgroundTask.ts`.

iOS decides when a background task runs — `BGTaskScheduler` typically grants a window
every few hours, learned from usage, and never at a guaranteed interval. So the
design's copy, *"Uiterlijk 20 minuten vooraf"*, is **not something local scheduling
can honour**. Delivering on it needs a server that watches the forecast and sends real
push, which was out of scope.

Two options when this is picked up:
- Build a small push service (watch the ensemble per subscribed location, send APNs).
- Or soften the settings copy to match what the app actually does.

### Splash screen

`app.json` sets none, so Expo's default applies. `logos/README.md` carries the
config to paste in, using the icons already there; the two background colours match
the app's own grounds.

### GFS and "Mix" — resolved: not wanted

Confirmed with the client (31 Aug 2026) that `index.html` never used GFS, and the
Open-Meteo sources should stay as close to it as possible. No model picker is shown,
and only ECMWF (plus KNMI HARMONIE-AROME for days 0–1) is requested — exactly the
web app's source set.

The `ModelPref` type remains in `core/prefs.ts` so stored preferences from an earlier
build still merge cleanly, but nothing reads it. Remove it if GFS is ruled out for
good.

### AgroExact connection is a token, not an account

The design shows a one-tap "Verbinden met AgroExact" toggle, implying an account
connection. The app asks for an API token instead, because that is what the API
supports today. The token is stored in the keychain via `expo-secure-store`. If a real
OAuth endpoint appears, the toggle can drive it without the settings layout changing.
