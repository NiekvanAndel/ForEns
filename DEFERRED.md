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
- **Sunshine minutes stay modelled.** The API reports global radiation, which is a
  different quantity; deriving bright-sunshine minutes from it would be a guess
  presented as a measurement. Say the word if an approximation is preferred. The
  radiation itself is now plotted on 'Grafiek' — see the unit note below.
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
- **The forecast on 'Grafiek' is always drawn** (the switch is gone, 9 Sep). It was
  not earning its place: the dash already says which half is which, more precisely
  than a checkbox above the chart could, and starting with it off meant the page's
  most-used window opened showing half of what it had. The line
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

### The radar's chart and scrubber (9 Sep 2026)

- **Play and pause moved** from the head of the scrubber into `NowcastHeader`,
  beside the location name. Glued to the track it read as part of the track; up
  there it sits with the other thing the panel says about the loop as a whole, and
  the scrubber gets the full width — which is what a scrubber wants, since its
  precision is its length.
- **The header is its own exported component** because on the map page the curve
  folds away and the play button must not fold with it. There the header is drawn
  outside the collapsing region and the panel is passed `showHeader={false}`.
  `PROFILE_MAX_HEIGHT` came down to 150 to match what is left inside the fold.
- **The chart's cursor is a grab handle**, a ring at 9pt with a small filled centre,
  rather than a 4.5pt dot. The whole plot takes the gesture, so it is an affordance
  and not a target — but a mark nobody would think to grab is a control nobody
  finds.
- **The chart draws the observed/forecast boundary** as a dashed rule, from the same
  `forecastBoundary` the scrubber uses for its tick. One number derived once: a rule
  at 40% over a tick at 43% reads as two boundaries rather than one drawn twice.
- **The header now renders without a profile.** It returned early before, so a
  location the nowcast covers no part of lost its play button along with its curve —
  the radar loop over it is perfectly good.

### The slider only where there is nothing else to drag (9 Sep 2026)

- **The radar card's slider is gone.** The curve above it is the scrubber — drag its
  handle and the loop follows — so the slider was the same control twice, in the
  height the map wanted.
- **It comes back where there is no curve to drag**, and that is one rule with two
  causes: on the map page, when the profile is folded down; on either page, when the
  nowcast has nothing to say about the location while the radar loop is still
  perfectly good. `hasNowcastCurve` answers it in one place so the two pages cannot
  disagree with what the panel actually drew.
- **On the map page the two trade places on the same gesture.** Open, the panel is
  the curve and its header — place, intensity, and a small play button beside the
  name. Swiped down, all of it folds away and what is left is one row: a full-sized
  play button and the slider beside it. Heights and opacities are exact inverses off
  the same shared value, so the panel keeps its height through the fold. The row is
  `pointerEvents: none` while the curve is up, or an invisible slider would swallow
  drags meant for the curve. With no curve at all there is nothing to fold, so the
  grabber goes and the row simply stands.
- **The play button is in whichever control is on screen**, small in the panel's
  header and full-sized at the head of the slider row. They are never both visible,
  so neither duplicates the other.
- **The playback timer moved into `useRadarFrames`.** It ran inside `Timeline`, which
  was fine while the scrubber was always on screen and is a bug now that it is not:
  playback would have stopped because its own progress bar was hidden. Whoever owns
  the index owns the clock, so `PLAY_INTERVAL_MS` lives there too and `Timeline` is
  pure presentation.

### Basemap labels in the app's language (9 Sep 2026)

MapLibre Native has no "set the map's language" call — `setLanguage` exists in the
web build and in Mapbox's SDK, not here. The labels live in the style, so the style
is what changes: `useMapStyle` fetches it, `localiseStyle` rewrites the `text-field`
of the layers that draw names, and MapLibre is handed the object instead of the URL.

- **The chain is language, then local name, then transliteration.** The middle step
  is the point: the stock style prefers an international field, which is why a Dutch
  app called the Belgian capital BRUSSELS. Falling back to `name` gives Brussel,
  Köln and Liège — the names on the road signs — wherever nothing is translated,
  which for the Netherlands, Belgium and western Germany is most of the map.
- **Only layers whose `text-field` already mentions a name are touched.** A basemap
  also labels motorway shields with `ref`, contours with `ele` and buildings with a
  house number; rewriting those would blank them. The test is a blunt "does this
  expression mention `name`", because the alternative is enumerating the layer ids
  of a style this app does not own.
- **It falls back to the URL on any failure**, so the map cannot end up worse than it
  was. Cached through TanStack for a day and keyed by URL and language, since both
  maps mount and unmount constantly and a style is a few hundred kilobytes.

**Not verified against the live tiles.** The network policy in the build environment
blocks `tiles.openfreemap.org` (as it did when the map was ported), so the style JSON
could not be fetched and the rewrite is pinned against hand-written fixtures instead.
Two things to check on a device:

1. Whether OpenFreeMap's tiles carry `name:nl` and friends at all. The OpenMapTiles
   schema guarantees `name`, `name_en`, `name_de` and the latin/nonlatin/int
   variants; the rest depend on how the tiles were generated. If they are absent the
   chain still falls through to `name`, which is the local name — so the map
   improves either way, just not into Dutch exotic-country names.
2. Whether any label disappears. That would mean a layer whose `text-field` mentions
   a name but draws something else, and the fix is to exclude it by id.

### A running rainfall total on 'Grafiek' (9 Sep 2026)

- **Rainfall carries a cumulative line over its bars**, computed in
  `core/model/series.ts` and drawn on top of them. It turns "it rained a bit most
  hours" into "and that came to eleven millimetres", which is what a rainfall chart
  is opened for. Only rainfall has one: a running total of temperatures is a number
  with no meaning.
- **The total starts at the left edge of the chosen window**, not at midnight or at
  the start of the record — a total that began off screen is one the reader cannot
  check. A gap carries the level forward rather than breaking the line: an unreported
  hour is unknown, not an hour that undid what fell before it. At day resolution the
  day's total is added once, after the bucketing.
- **It shares the bars' axis, as asked**, rather than taking a second one down the
  right-hand edge. Two scales on a phone is two things to hold in your head at a
  glance, and the reason to want the total here is to see it against the showers that
  produced it. The cost is real: a month's total dwarfs any single hour, so the bars
  flatten under it.
- **Drawn in heading ink, not a second blue.** Design rule 2 gives every quantity
  its own colour, so a rainfall total cannot borrow the amber that means temperature
  or the green that means a station — and a darker shade of the bars' own blue is not
  a distinction at a glance. Ink is not a quantity's colour, which is the honest
  thing for a line derived from the bars underneath it.
- **Its forecast half is dashed**, like every other forecast on this page. The run
  splitting that does it is now shared by the value line, the gusts and the total, so
  all three break at the same places and dash on the same side of the boundary.
- **The cursor rides the total while it is up**, and the bars when it is not. With
  the line drawn, that is the mark the eye is following, and a dot sitting on a bar
  top halfway down the plot reads as pointing at something else.
- **Which is why the legend entry is a switch.** Tapping it drops the line, and the
  axis then fits the bars alone, because `SeriesChart` scales to what is actually
  drawn. So the toggle is not a nicety but the other half of the decision to share
  the axis. Switched off, the entry dims and keeps its place — a legend entry that
  vanished when you used it would be a control you could turn off once.

### One day at the grain a station reports on (9 Sep 2026)

- **A one-day window fetches raw readings**, about one every ten minutes, instead of
  the hourly roll-up. An hourly bar cannot tell a quarter of an hour of heavy rain
  from a wet hour, and on a one-day chart that is the distinction the reader came
  for. Longer windows stay on `/aggregates/`: a month of ten-minute records is
  thousands of points nobody can read.
- **`buildSeries` gained a step size** rather than a second code path. The grid, the
  bucketing threshold and the labels follow from `stepMinutes`; the sources are
  consulted per sample exactly as before, and a modelled value — stamped on the hour
  — answers for the minutes inside its own hour, because the model has nothing to say
  about twenty past three in particular.
- **The finer grid is only used where the station actually answered.** Ten-minute
  samples are worth their extra points when they are filled and are a row of gaps
  with an hourly model behind them when they are not.
- **`/readings/` may stream NDJSON**, one record per line, where `/aggregates/`
  answers with an array. Which shape a given path returns could not be settled from
  here, so `parseRows` reads either and skips a line it cannot parse. The
  already-shipped `latest=true` call goes through it too — if that endpoint was
  streaming, the hero's measured "now" was silently empty before this.
- **Assumed, not verified:** that a reading's `precipitation` is the rainfall in that
  interval rather than a running total. It is what the field name and the hourly
  aggregate's use of it imply, and it is what the cumulative line and the summary
  total depend on. A day whose total reads far too high is the sign it is wrong.

### Six quantities on 'Grafiek' (9 Sep 2026)

- **Wind direction and radiation added.** A bearing is plotted as points, not a
  line: a stroke from 315° to 45° draws the wind swinging through south, which is
  the one thing it did not do. Its axis is pinned to 0–360 rather than fitted, or a
  day that blew between 170° and 190° fills the plot with what is very nearly one
  steady direction. Bucketing a day of bearings uses a circular mean — 350° and 10°
  come to 0°, where the arithmetic mean says due south.
- **Radiation is plotted in W/m², from the station where there is one.**
  `processAll` now keeps radiation on every hour (the field was already fetched for
  the sunshine estimate and thrown away); the parity suite projects the addition away
  and asserts separately that it is populated, as it does for the gust.
- **Axis bounds are per quantity.** Humidity stays dynamic but cannot leave 0–100;
  rainfall, wind and radiation cannot go below zero; temperature has neither bound,
  because below zero is a real reading.
- **Summaries follow the quantity.** Min / gemiddeld / max for temperature, humidity
  and radiation — just "Min" and "Max", since the quantity is already named on the
  pill and on the axis. Wind reads gemiddeld / max wind / max windstoot, because a
  minimum wind speed is a number nobody acts on. Rainfall keeps total and peak, and
  a bearing has no summary at all.
- **The selector is a horizontal scroller.** At six, pills across the width wrapped
  to two lines each and the row grew taller than the summary under it.
- **The chart's own left padding came down from 42 to 30**, and the card's from 12 to
  4. Three nested margins for one chart, and the width belongs to the data.

### `global_radiation` means two different things (9 Sep 2026)

**Settled against the live API**, which resolves the contradiction between this
file's old note (J/cm²) and the AgroExactRN client's comment (W/m²). Both were
right, about different endpoints:

| Endpoint | Unit | Hedikhuizen, 21 Jun 2026 |
| --- | --- | --- |
| `/aggregates/` | J/cm², the hour's energy | 309.96 for the hour ending 13:00Z |
| `/readings/` | W/m², the irradiance then | 828–892 across that same hour |

861 W/m² averaged over 3600 s is 3.10 MJ/m², which is 310 J/cm². The same quantity,
twice, under one field name — exactly the kind of thing that produces a chart nobody
can tell is wrong.

So the conversion sits at the edge, in `JCM2_PER_HOUR_TO_WM2`: an aggregate is
multiplied by 10⁴/3600, a reading is taken as it stands, and Open-Meteo's
`shortwave_radiation` joins them unchanged. Everything above `core/sources` is W/m²
and nothing downstream has to know. Pinned in `tests/sources.test.ts` against the
two figures above.

### The measured spread inside an hour (9 Sep 2026)

`/aggregates/` reports a minimum and a maximum alongside the mean, and only for two
quantities: `temperature_150` and `humidity_150`. Both are now drawn as a band behind
the line on 'Grafiek', where before the page plotted the mean alone — an hour that ran
from 8° to 14° and an hour that sat at 11° are the same line and very different
weather. The humidity pair was not even being fetched; the temperature pair was
fetched, mapped and then read by nobody.

- **Only where a station reports it.** The weather model gives one figure per hour,
  so a modelled sample has no band and does not pretend to.
- **Nothing else has one.** Radiation's aggregate is a single figure — the hour's
  energy, which converted *is* the hourly mean — and wind's spread is already drawn
  as the gust line above it rather than as a band around it.
- **A bucketed day now reaches as far as its hours' own spreads**, not merely to the
  highest and lowest hourly mean: the coldest minute of the day was inside some
  hour's minimum.
- A raw ten-minute reading has no spread inside itself, so the one-day chart draws
  the line alone.

The test fixture used to hand every measured hour a minimum of 19 and a maximum of
21 while tests overrode the mean to 10 — an hour whose mean sat outside its own
bounds. Harmless while nothing read the pair; it became a wrong assertion the moment
something did. The fixture now defaults both to nothing and each test states the
spread it is about.

### The band's edges as lines you can switch (9 Sep 2026)

Temperature and humidity draw three lines now — the central value and each edge of
the band — and each has its own legend switch. A minimum and a maximum are readings
a grower acts on, not a shaded area to squint at; and three lines with a fill over
thirty days is a great deal of ink for someone who came to look at one of them, so
each can be put away. One of the three always stays on: a chart of nothing is a card
with an axis in it.

- **The two do not share a colour scheme.** Warm is red and cold is blue, so
  temperature's maximum is red — but humidity runs the other way, since it is the
  *dry* end that is the hot, parched one, so its minimum takes the red. Following
  the number rather than the word is what keeps a reader from checking the legend
  twice.
- **Only those two get named edges.** Wind and radiation do have a band at day
  resolution, but it is the spread of hourly means rather than a reported extreme —
  a number to look at, not one to put a coloured line through and a word under.
- **The central line's label follows the location.** "Gemeten" where an instrument
  answered, "Berekend" where the model did. The day-resolution band exists on a
  modelled location too — it is bucketed from hourly values — so the old legend,
  which only ever said "Gemeten", would have been wrong there.
- The edges run through the same run splitting as everything else, so they break
  where the data does and dash on the same side of the measured/forecast boundary.

### One pill row, two pages (9 Sep 2026)

The measurement switcher moved out of the period card and into the chart card: one
card is about *when*, the other about *what*, and a switcher belongs to the thing it
changes. Its heading went with it — six labelled pills are not a list that needs to
be told what it is — and the period card, now holding one section, is that section.

The row itself is `ui/PillSwitcher`, extracted from 'Verwachting''s layer switcher
and now used by both: same gradient, same icons for the quantities the two pages
share, so a reader moving between them meets the same picture for the same thing.
The quantity's own colour stays on the *line*; the pill carries the accent gradient
like every other switcher in the app.

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
