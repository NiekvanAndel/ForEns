/**
 * Local weather notifications.
 *
 * These are *local* notifications scheduled from the forecast the device already has,
 * refreshed by the background task — the stand-in until the push service exists. An
 * alert can only be as fresh as the last background window iOS granted, which is
 * typically every few hours, so "uiterlijk 20 minuten vooraf" is not something this
 * can promise. The settings screen says as much while the endpoint is unset; the
 * contract for the service that would fix it is `docs/push_contract.md`.
 *
 * Deciding *what* is worth alerting about is `core/model/alert`, so a notification
 * and the Nowcast hero can never disagree. Whether the reader wants either is
 * `Prefs.alertsEnabled` and `Prefs.pushEnabled` — see `planNotification`.
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

  // Both layers, in order. `alertsEnabled` off means the app shows no block, and
  // notifying about something it has been told not to show is a contradiction;
  // `pushEnabled` off means the reader asked not to be interrupted, and these local
  // notifications are what stands in for push until the server exists.
  if (!prefs.alertsEnabled || !prefs.pushEnabled) return null;

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

/** Asking for permission lives with the push client now, since both layers need
 *  the same answer and two copies of a prompt is two chances to drift. */
export { requestNotificationPermission } from './push';

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
