# Push notifications — the server's half

The app's half is built: `core/push.ts` decides what a device should be registered
for, `core/pushSync.ts` runs it, and `state/push.ts` re-runs it whenever a preference
that shapes a registration changes. Nothing is sent until an endpoint exists.

**To switch it on, set `extra.pushEndpoint` in `app.json` to the service's base URL.**
That is the whole of the client change. With it empty — which is how the app ships
today — every sync is a no-op: no request, no error, no retry.

## What the device sends

`POST <endpoint>/registrations`, `content-type: application/json`:

```json
{
  "v": 1,
  "token": "ExponentPushToken[xxxxxxxx]",
  "platform": "ios",
  "kinds": ["rain", "storm", "wind"],
  "places": [{ "name": "Wageningen", "lat": 51.969, "lon": 5.665 }],
  "rules": [
    { "id": "m1k2j3-a7f0", "tileId": "temp", "op": "below", "value": 2, "stationIds": ["1234"] }
  ],
  "lang": "nl",
  "tempUnit": "C",
  "windUnit": "kmh",
  "tzOffsetSec": 7200,
  "quietHours": true,
  "appVersion": "0.1"
}
```

- **`token`** is an Expo push token. The service delivers through Expo's push API, so
  it needs no APNs key of its own; moving to raw APNs later changes what
  `requestPushToken` asks for and nothing else in the payload.
- **`kinds`** are the alert kinds from `core/model/alert`, filtered to the ones a
  reader can subscribe to (`PUSH_KINDS`). Sorted, always. Fog and heat are absent
  deliberately — they earn a block on the screen, not a buzz.
- **`places`** are every saved location, rounded to three decimals (~100 m).
- **`rules`** are thresholds the reader set themselves, from a block on 'Actueel'.
  Empty on most devices. `tileId` identifies the quantity *and its window* — `temp` is
  the current temperature, `rain-24h` the last 24 hours' total, `temp-min` the lowest
  of the last 24 — and the mapping is `modelTiles` in `core/model/tiles.ts`. `value`
  is in canonical units (°C, km/h, mm, %, degrees) whatever the phone is set to
  display, and `op` is strict: `above` fires over the value, never at it. A rule names
  AgroExact station ids, so evaluating them needs station access as well as a
  forecast. Rules alone are reason enough for a device to be registered — someone may
  want their own threshold and none of the built-in kinds.
- **`tzOffsetSec`** and **`quietHours`** are for the 22:00–07:00 window. Enforce it
  server-side: a push that arrives at 03:00 has already woken someone, and dropping
  it on receipt is too late.
- **`appVersion`** is informational. It is deliberately *not* part of the digest the
  device uses to decide whether to re-register, so a release does not re-register
  every device at once.

`DELETE <endpoint>/registrations/<url-encoded token>` withdraws it.

Both are **idempotent by token**. A device that registers twice is one row; a device
that deregisters twice succeeds both times. The client re-sends whenever its digest
changes and has no way to ask what the server currently holds, so the token is the
only key that can be relied on.

## What the service has to do

1. Poll the forecast per distinct `(lat, lon)` — deduplicate across devices, since
   many will share a place.
2. Run `deriveAlert`'s rules against it. **The thresholds live in
   `core/model/alert.ts` and the service must not hold a second copy of them**: a
   notification that disagrees with the block the app draws is the one failure mode
   that would make people distrust both. Port the module, or expose it.
3. For each device subscribed to that kind at that place, and outside its quiet
   hours, send one notification.
4. For each `rule`, poll its stations and compare. A reading that is missing is not a
   reading that is safe: do not fire on a gap. `core/alerts.ts` has the comparison and
   its tests; `evaluateAlert` is four lines and worth porting rather than rewriting.
5. Deduplicate per device, per kind, per event — the local fallback keys on `kind`
   plus the hour for the same reason. Three notifications for one shower is how an
   app gets its notifications switched off wholesale.

Title and body for the built-in kinds follow the local fallback in `core/notifications.ts`:
`"<label> · <place>"` and `"<headline>. <sub>"`. Both come out of `deriveAlert`, which
takes `{ lang, tempUnit, windUnit }` — so a service that honours the registration's
`lang`, `tempUnit` and `windUnit` writes exactly what the block on the device says.

## Known gaps

- **Until the endpoint exists**, alerts are scheduled locally by the device from
  whatever the background task last fetched. iOS grants that window every few hours
  and never on a schedule, so *"uiterlijk 20 minuten vooraf"* is not a promise the app
  can keep on its own. The settings screen says so rather than leaving it to be
  discovered.
- **No EAS `projectId`.** `getExpoPushTokenAsync` needs one and `app.json` has none,
  so no device can currently produce a token. That is survivable only because
  permission and token are asked for separately: permission alone switches the local
  fallback on, and a missing token means a registration cannot be *sent*, which
  matters exactly as much as the absent server does. Add `extra.eas.projectId` in the
  same change as the endpoint.
- **No silent push.** `enableBackgroundRemoteNotifications` is off in `app.json`. If
  the service should be able to wake the app to refresh the widget, that flag and a
  `content-available` payload are the change.
