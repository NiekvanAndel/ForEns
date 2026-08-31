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

### Widget icon

`targets/widget/expo-target.config.js` sets no icon. Design rule 4 states there is no
logo and that one must never be drawn or approximated, so none was invented — the
widget inherits the app icon. Supply a real asset when one exists.

### App icon and splash screen

`app.json` sets neither, so Expo's defaults apply. Same reason as above.

### GFS and "Mix" model options

The settings screen offers `ecmwf`, `gfs` and `mix` because the design specifies
them, and the preference is stored — but **only ECMWF is wired to a data source**.
Open-Meteo does serve GFS, so `gfs` is a small change in `core/sources/openMeteo.ts`.
`mix` needs a blending rule that has never been defined; it is a product decision, not
a coding one.

### `shortModel` preference is stored but unused

Same situation: the Nowcast/Radar toggle is persisted and has no effect yet. It would
select which source drives the 0–2h view once a second one exists.

### AgroExact connection is a token, not an account

The design shows a one-tap "Verbinden met AgroExact" toggle, implying an account
connection. The app asks for an API token instead, because that is what the API
supports today. The token is stored in the keychain via `expo-secure-store`. If a real
OAuth endpoint appears, the toggle can drive it without the settings layout changing.
