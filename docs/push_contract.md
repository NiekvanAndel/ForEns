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
4. Deduplicate per device, per kind, per event — the local fallback keys on `kind`
   plus the hour for the same reason. Three notifications for one shower is how an
   app gets its notifications switched off wholesale.

Title and body follow the local fallback in `core/notifications.ts`:
`"<label> · <place>"` and `"<headline>. <sub>"`.

## Known gaps

- **`deriveAlert` writes Dutch only.** Its headlines and sub-lines are built as string
  literals, outside the i18n tables, so the block and any notification stay Dutch on a
  device set to English or German. The registration already carries `lang`; the
  strings have to move into `core/i18n` before that means anything.
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
