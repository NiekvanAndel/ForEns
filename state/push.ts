/**
 * The push registration, driven from the app.
 *
 * The work is `core/pushSync`; this is the one part that belongs to the React tree —
 * re-running the sync whenever a preference that shapes a registration changes.
 *
 * On every change rather than only at launch, because the registration carries the
 * reader's locations, language and units: rename a place or switch to Fahrenheit and
 * the next notification should say so. The digest in `core/push` is what stops that
 * being a request per keystroke.
 */
import { useEffect, useRef } from 'react';
import { syncPush } from '../core/pushSync';
import type { Prefs } from '../core/prefs';

export { configureNotifications, enablePush, pushEndpoint, syncPush } from '../core/pushSync';

/** Sync whenever the preferences that shape a registration change. */
export function usePushSync(prefs: Prefs): void {
  // Serialised, so the effect does not fire on every unrelated preference change —
  // a font size has nothing to do with a notification.
  const key = JSON.stringify([
    prefs.alertsEnabled, prefs.pushEnabled, prefs.quietHours,
    prefs.notifyRain, prefs.notifyWind, prefs.notifyFrost,
    prefs.lang, prefs.tempUnit, prefs.windUnit,
    prefs.locations.map((l) => `${l.name}|${l.lat}|${l.lon}`),
    prefs.userAlerts.map((a) => `${a.id}|${a.enabled}|${a.op}|${a.value}|${a.stationIds.join('+')}`),
  ]);
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (last.current === key) return;
    last.current = key;
    syncPush(prefs).catch(() => {});
    // `prefs` is read inside, but `key` is what decides whether it matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
