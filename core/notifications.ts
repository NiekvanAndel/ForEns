/**
 * Local weather notifications.
 *
 * These are *local* notifications scheduled from the forecast the device already
 * has, refreshed by the background task. No push server exists, and building one
 * was not in scope — the practical consequence is that an alert can only be as
 * fresh as the last background refresh iOS granted, which is typically every few
 * hours rather than the "uiterlijk 20 minuten vooraf" the design's copy promises.
 * That gap is real and is recorded in DEFERRED.md.
 *
 * Deciding *what* is worth alerting about is `core/model/alert`, so a notification
 * and the Nowcast hero can never disagree.
 */
import type { WeatherAlert } from './model/alert';
import type { Prefs } from './prefs';

/** Quiet hours, per the design's "Geen meldingen tussen 22:00 en 07:00". */
export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 7;

export interface PlannedNotification {
  /** Stable id, so re-planning replaces rather than duplicates. */
  id: string;
  title: string;
  body: string;
  /** When to fire, epoch milliseconds. */
  atMs: number;
}

/** True when a moment falls inside the do-not-disturb window. */
export function inQuietHours(atMs: number, tzOffsetSec = 0): boolean {
  const local = new Date(atMs + tzOffsetSec * 1000);
  const h = local.getUTCHours();
  // The window wraps midnight, so it is a union rather than a range.
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

/** Push a moment forward to the end of quiet hours. */
export function afterQuietHours(atMs: number, tzOffsetSec = 0): number {
  if (!inQuietHours(atMs, tzOffsetSec)) return atMs;
  const local = new Date(atMs + tzOffsetSec * 1000);
  const next = new Date(local);
  if (local.getUTCHours() >= QUIET_START_HOUR) next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(QUIET_END_HOUR, 0, 0, 0);
  return next.getTime() - tzOffsetSec * 1000;
}

/** Which alert kinds each preference covers. */
const KIND_PREF: Record<WeatherAlert['kind'], keyof Prefs | null> = {
  rain: 'notifyRain',
  storm: 'notifyRain',
  wind: 'notifyWind',
  frost: 'notifyFrost',
  fog: null,
  heat: null,
};

export interface PlanOptions {
  locationName: string;
  tzOffsetSec?: number;
  nowMs?: number;
}

/**
 * Turn an alert into a notification, or nothing.
 *
 * Returns at most one: three notifications for one weather event is how an app
 * gets its notifications switched off entirely.
 */
export function planNotification(
  alert: WeatherAlert | null,
  prefs: Prefs,
  opts: PlanOptions
): PlannedNotification | null {
  if (!alert) return null;

  const prefKey = KIND_PREF[alert.kind];
  if (!prefKey || !prefs[prefKey]) return null;

  const nowMs = opts.nowMs ?? Date.now();
  const tz = opts.tzOffsetSec ?? 0;

  let atMs = nowMs;
  if (prefs.quietHours) {
    atMs = afterQuietHours(atMs, tz);
    // A shower two hours away is not worth waking someone about at 07:00 the next
    // morning, by which time it has already happened.
    if (atMs - nowMs > 6 * 60 * 60 * 1000) return null;
  }

  return {
    // Keyed by kind and day so the same event does not re-notify on every refresh.
    id: `${alert.kind}-${new Date(nowMs + tz * 1000).toISOString().slice(0, 13)}`,
    title: `${alert.label} · ${opts.locationName}`,
    body: `${alert.headline}. ${alert.sub}`,
    atMs,
  };
}

/**
 * Ask for notification permission.
 *
 * Split out so the settings screen can request it at the moment a toggle is turned
 * on rather than at launch, which is both better practice and more likely to be
 * granted. Imports lazily so `core/` stays free of native modules for the tests.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const Notifications = await import('expo-notifications');
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/** Schedule a planned notification, replacing any earlier one with the same id. */
export async function scheduleNotification(plan: PlannedNotification): Promise<void> {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(plan.id).catch(() => {});
    const seconds = Math.max(1, Math.round((plan.atMs - Date.now()) / 1000));
    await Notifications.scheduleNotificationAsync({
      identifier: plan.id,
      content: { title: plan.title, body: plan.body, sound: true },
      trigger: { type: 'timeInterval', seconds, repeats: false } as never,
    });
  } catch {
    // A failed schedule costs an alert, not the session.
  }
}
