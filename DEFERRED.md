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

- **Everything the station reports is used, per quantity.** Both data calls pass
  `station_only=false`, so AgroExact substitutes external data for what a given unit
  does not measure itself and a RainExact location gets a complete page. Whatever
  still comes back empty stays modelled. The weather icon is never replaced — a
  station measures quantities, not conditions.
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

## Actueel, Grafiek, and the map page (9 Sep 2026)

Two pages added and one relationship inverted.

- **Actueel** is a fixed grid of twelve blocks built from the forecast model
  (`core/model/tiles.ts`), which on a station-backed location already carries that
  station's readings. It first read the account's dashboard catalog instead; see the
  follow-up round below for why that came out again. The two kinds of value are told
  apart by the station dot, per block, because a rain gauge measures some of them
  and not others.
- **Grafiek** plots one quantity over a chosen period. On a station-backed location
  it is the station's own hourly record from `/aggregates/{id}/`, running on into
  the forecast past the current hour; elsewhere it is the model alone. Measurement
  is drawn solid and forecast dashed, always, with a rule where they meet — see
  `core/model/series.ts`, which marks every sample with its source. A window longer
  than three days is bucketed into days, and a day counts as measured only if every
  hour in it that had a value was measured.
- **Built with what was already here.** No `react-native-gifted-charts`, no
  `@expo/ui`: the chart is `react-native-svg` in the idiom of `SpreadChart`, the
  period presets are the app's own pills, and the from/to fields open a month grid
  (`ui/graph/RangeSelector.tsx`) rather than a native picker. Agreed 9 Sep 2026 —
  no new native modules, so no rebuild, and the pages look like the rest of the app.
- **The map is a page, not a modal.** `app/map.tsx` holds the full-screen map. The
  top row's map button pushes it, and so does the full-screen button on 'Radar' —
  which used to be the owner of a modal that the top row reached by routing to the
  radar tab with `full=1`. Both arrive at the selected location, because the
  selection is shared state and nothing is passed between them.
- **Six tabs.** `GlassTabBar` sizes its icons from how many there are (21pt at six,
  25pt at four) and grows the vertical padding to match, so the bar keeps its height
  and its touch targets on a narrow phone.

Worth knowing:

- 'Grafiek' skips its network call while the pager is peeking at it, so a swipe does
  not cost a month of measurements for a location the reader may not stop on.
  'Actueel' has no call of its own to skip.

### Follow-up rounds (9 Sep 2026)

- **The conditions hero opens 'Actueel'.** The whole card is a button, with a caret
  in its corner so it looks like one.
- **'Actueel' no longer reads the account's dashboard catalog.** `/aggregations/`
  and `/aggregations/values/` are gone from the app. Two requirements killed them
  together: the block set is meant to be a fixed twelve, which a catalog someone
  edits on the web cannot promise, and the page has to speak the language set in
  Instellingen rather than the one the API's content negotiation picks. Nothing was
  lost by dropping them — `applyStationObservations` already merges a station's
  readings into `pastHours` and `station.current`, so the same twelve blocks show
  measured numbers on a station location without asking the account anything.
  (`fetchAggregationBlocks`, `fetchAggregationValues` and `useDashboardBlocks` are
  in the git history if the dashboard is ever wanted as a separate surface.)
- **The twelve, in order:** temperature, humidity, wind speed, gust, wind direction,
  max gust today, rainfall over 6h / 12h / today / 24h, and max/min temperature.
  Rolling windows and calendar days are both there and labelled apart — at four in
  the afternoon "vandaag" and "laatste 24 uur" are different numbers. Max/min
  temperature is the rolling 24 hours, matching the hero on 'Nu'; say the word if it
  should be the calendar day like the max gust.
- **The green dot is decided per quantity**, from whether the station's latest
  reading carries that quantity at all — a station either has an anemometer or it
  does not. Marking every block on a station-backed location as measured would have
  put an instrument's authority behind a number the model supplied.
- **A silent date bug.** The `/aggregates/` range call was sending `YYYY-MM-DD`
  where the API wants `dd-mm-YYYY`, so every window the graph page asked for came
  back empty and only the axis moved. `apiDay` converts it now.
- **The forecast on 'Grafiek' is a switch, off by default.** Turned on, the line
  carries past the current hour and the date fields reach as far ahead as the model
  does — `futureHours` stops at 48 hours, so the series falls back to the IFS hourly
  set behind the day sheets for anything further, which is the full horizon. Past
  its ninetieth hour that set is three-hourly, and the chart draws a line through
  gaps of up to two forecast samples: a coarsely sampled series is still one series.
  Measured gaps are never bridged.
- **One sentence for a location with no station:** "Voor deze locatie is alleen de
  laatste 24 uur beschikbaar als historie". It replaced two different messages for
  the short and long windows, which read as two different limitations when it is
  one — the weather model carries about a day of observations, not an archive.

### Comparing a block across locations (9 Sep 2026)

Tapping a block on 'Actueel' opens it for every saved location, as the web app's
'Actueel' does for every station on the account.

- **Each location is loaded from the observation feed alone** — one request per
  place, covering yesterday and today, which is exactly the window the blocks are
  computed over. `processAll` builds a model from it with no forecast call
  (`loadObservations` + `useAllLocationConditions`), and a station location then has
  its own measurements merged over the top, so a station reads the same number in
  the sheet as on its own page.
- **Not the forecast cache.** It holds three locations at most, and only ones the
  reader has visited or swiped past — a list built from it would be mostly blank in
  exactly the case the sheet exists for. Its models are also the full staged build,
  which is a lot of work for twelve current readings.
- **One query per location, not one for the list**, so a slow or failing place costs
  its own row rather than the sheet. Nothing is fetched until the sheet opens.
- **Rows are sorted highest first**, except a wind direction, which keeps the saved
  order: 350° is not more than 10°, and sorting bearings by degrees puts north at
  both ends of the list.
- **`processAll` now keeps the gust on observed hours.** The observation feed
  reports it and the web app never read one off a past hour, so it was dropped —
  which meant "max. windstoot vandaag" could only ever be answered on a location
  with a station. The parity suite projects the addition away and asserts separately
  that it is populated, as it already does for `tempExact` and `windExact`.

### Two rainfall forecasts, and an arrangeable grid (9 Sep 2026)

- **Two blocks added:** rainfall expected in the next hour, from the DGMR nowcast run
  behind the radar page, and in the next 24 hours, from the weather model. The
  one-hour block integrates the nowcast series the same way `buildProfile` computes
  its own total, so the block and the radar page cannot disagree about one run.
  Outside the radar's coverage it reads as a dash rather than falling back to the
  model — the point of the block is that the nowcast is the sharper source over that
  hour, and a silent swap would compare two different forecasts down one column.
- **This bends 'Actueel' on purpose.** The page was strictly about what has happened;
  these two are forecasts, asked for because a grower deciding on the next hour wants
  that answer beside the last one. They are named for what they are, carry a forward
  window, and can never be measured — the green dot is off on both whatever station
  stands at the location.
- **The grid can be arranged.** A pencil beside the source line opens `TileEditor`:
  long-press to drag, tap to switch a block off. The drag is `LocationList`'s,
  reused rather than reinvented, since those are the app's only two reorderable
  lists. A hidden block dims and keeps its place instead of dropping to a second
  section, so switching it back leaves it where the reader expects. The last visible
  block cannot be switched off.
- **`prefs.tiles` is new persisted state**, stored as an order plus a hidden set
  rather than as "these blocks, in this order". The difference only shows later: a
  block added in a future version is in neither list, so it appears, in its natural
  place, for someone who arranged their grid last month — where the obvious shape
  would have silently hidden every future block from exactly the people who bothered
  to arrange it. `mergePrefs` takes the two halves independently and drops anything
  that is not a string, so a malformed stored value costs the arrangement and not
  the launch. Additive: no existing preference key changed.

### Two things to verify against the live API

1. **The bearer scheme.** The schema documents `Authorization: Token <api key>`; an
   AuthKit access token is sent as `Bearer`, and only as `Bearer`. If the first live
   sign-in returns 401 on `/stations/` with a token that was just minted, the scheme
   is the suspect: `agroHeaders` in `core/sources/agroexact.ts` is the one line to
   change.
2. **Switching accounts.** Signing out revokes the grant at WorkOS, but the browser
   cookie outlives it, so the authorize request asks for `prompt=login`. WorkOS
   accepts the parameter — checked against the live endpoint — but AgroExact hosts
   its own login page at `app.agroexact.com/login/`, and whether that page honours
   the request or shows a signed-in user straight through is a question only a real
   sign-out-and-reconnect answers.
3. **The redirect URI.** `exactcast://oauth/agroexact` must be registered on the
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
