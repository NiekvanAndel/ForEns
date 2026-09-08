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

Three surfaces are built, tested and working, but **not shown in the UI** at the
client's direction (31 Aug 2026). The fourth, AgroExact, is now shipped. Each is hidden rather than deleted: preferences,
plumbing and tests all remain, so re-exposing one means restoring its rows in
`app/(tabs)/settings.tsx`.

| Hidden | Where the code still lives | Why |
| --- | --- | --- |
| **Meldingen** (rain / wind / frost / quiet hours) | `core/notifications.ts`, `core/backgroundTask.ts` | To be worked out later — see the push limitation below |
| **Korte termijn: Nowcast / Radar** | `prefs.shortModel` | Needs a second 0–2h source to choose between |
| ~~**AgroExact integration**~~ | ~~`core/sources/agroexact.ts`, `state/stations.ts`~~ | **Done** — see below |
| ~~App and widget icon~~ | ~~—~~ | **Done** — see `logos/README.md` |

The background task still runs and still keeps the widget current; it simply
schedules no notifications while every notify preference is off, which is the
default.

## The AgroExact integration (8 Sep 2026)

Instellingen → Integraties connects an AgroExact account over OAuth (WorkOS AuthKit,
PKCE, no client secret). The stations on that account become locations named after
their town, and those locations show measured data instead of modelled data.

Decisions worth knowing about:

- **Only what is measured is replaced, per quantity.** A RainExact fills in the
  rainfall and leaves everything else to the model. The weather icon is never
  replaced — a station measures quantities, not conditions.
- **Sunshine minutes stay modelled.** The API reports global radiation (J/cm²),
  which is a different quantity; deriving bright-sunshine minutes from it would be a
  guess presented as a measurement. Say the word if an approximation is preferred.
- **The hero's figures are now a rolling 24 hours** — minimum, maximum and rainfall
  total — for *every* location, station-backed or not. They were today's forecast
  extremes, which mixed a measured present with a modelled afternoon. `pastHours` is
  24 hours long for this, where the web app kept 12; the parity suite compares the
  last twelve and asserts the rest separately.
- **Forecasts, ensemble spread, radar and notifications are untouched.** They come
  from the weather models on a station-backed location exactly as they do anywhere.
- **The widget gets the measured "now" for free** (it reads `currentTemp` and
  `pastHours` off the same model) but has no station styling of its own. Not asked
  for; noted so it is not a surprise.
- **Locations survive a disconnect.** Signing out, or a refresh token WorkOS rejects,
  leaves the towns in place as ordinary Open-Meteo locations and puts a warning in
  Instellingen. Only a station leaving the account removes its location.

### Two things to verify against the live API

1. **The bearer scheme.** The schema documents `Authorization: Token <api key>`; an
   AuthKit access token is sent as `Bearer`. `agroFetch` retries once under `Token`
   on a 401, so both work, but the first live sign-in will confirm which it is.
2. **The redirect URI.** `exactcast://oauth/agroexact` must be registered on the
   AuthKit application, verbatim. It is `REDIRECT_URI` in `state/auth.tsx`.

### TanStack Query

Adopted for everything AgroExact: the station list is asked for by four call sites
and is now fetched once. The Open-Meteo pipeline was **left as it is** deliberately —
it is a staged load where each stage re-runs `processAll` over the ones before it,
with its own abort handling, a disk-backed model cache and neighbour prefetching for
the pager. Query would have to model that as five dependent queries plus a derived
selector, and would not remove the cache it already has. Radar frames and the
place-search debounce are the two remaining candidates that would genuinely gain
from it; neither is in this change.

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
