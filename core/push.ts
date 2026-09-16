/**
 * Push notifications: what the device tells the server, and when.
 *
 * `core/notifications.ts` schedules *local* notifications from the forecast the phone
 * already holds. That has a ceiling nothing on the device can lift: iOS grants a
 * background window every few hours and never on a schedule, so "twenty minutes
 * before the shower" is not a promise local scheduling can keep. Real push means a
 * server that watches the forecast and sends APNs, and this is the device's half of
 * that: register, keep the registration true, and deregister.
 *
 * The server does not exist yet. That is deliberate and it is why this file is
 * shaped the way it is — every piece that can be decided on the device is decided
 * here and tested, and the only thing missing is an endpoint to POST to. When one
 * appears, `pushEndpoint` in `app.json`'s `extra` is the whole of the change.
 * `docs/push_contract.md` is the other side of it.
 *
 * ## What is sent, and what is not
 *
 * A registration is the token, the locations to watch, the kinds to watch for, and
 * enough context to write the message in the reader's own language and clock. No
 * account, no device identifier of our own, no readings: the server needs to know
 * where to look and where to send, and nothing else about the person.
 *
 * ## Why a digest
 *
 * Preferences change on every tap, and a POST per tap would be a request per letter
 * while someone renames a location. The registration is hashed and the hash is what
 * decides whether anything is sent, so switching a toggle on and off again is not a
 * round trip.
 */
import type { WeatherAlert } from './model/alert';
import type { Prefs, SavedLocation } from './prefs';

/** The alert kinds a reader can subscribe to, and the preference behind each.
 *
 *  Fog and heat are absent on purpose: they are worth a block on the screen, and a
 *  phone buzzing at midnight because tomorrow is warm is how an app gets its
 *  notifications switched off wholesale. */
export const PUSH_KINDS = {
  rain: 'notifyRain',
  storm: 'notifyRain',
  wind: 'notifyWind',
  frost: 'notifyFrost',
} as const satisfies Partial<Record<WeatherAlert['kind'], keyof Prefs>>;

export type PushKind = keyof typeof PUSH_KINDS;

/** One place the server watches on this device's behalf. */
export interface PushPlace {
  name: string;
  lat: number;
  lon: number;
}

/**
 * Everything the server needs to send this device a useful notification.
 *
 * Versioned, because a registration outlives the app that wrote it: a device that
 * never updates keeps whatever it last sent, and the server has to know how to read
 * it. Bump `v` when a field changes meaning rather than when one is added.
 */
export interface PushRegistration {
  v: 1;
  /** The Expo push token. APNs is reached through it, so the server needs nothing
   *  Apple-specific to deliver. */
  token: string;
  platform: 'ios' | 'android';
  /** Which alert kinds this device wants, in a stable order. */
  kinds: PushKind[];
  places: PushPlace[];
  /** So the server writes in the language the app is set to, not the phone's. */
  lang: Prefs['lang'];
  /** Units, so a body reads "18 °C" or "64 °F" as the reader expects. */
  tempUnit: Prefs['tempUnit'];
  windUnit: Prefs['windUnit'];
  /** Seconds east of UTC, for the quiet-hours window the server enforces. */
  tzOffsetSec: number;
  /** Nothing between 22:00 and 07:00 local. Held server-side as well as on the
   *  device: a push that arrives at 03:00 has already woken someone, and dropping it
   *  on receipt is too late. */
  quietHours: boolean;
  appVersion: string;
}

export interface BuildOptions {
  token: string;
  platform?: 'ios' | 'android';
  tzOffsetSec?: number;
  appVersion?: string;
}

/**
 * The registration for a set of preferences, or null where there is nothing to
 * register.
 *
 * Null is the deregistration case and the caller treats it as one: push switched
 * off, alerts switched off entirely, every kind unticked, or no place to watch.
 * Returning null rather than an empty registration means the server is never asked
 * to keep a row that would produce nothing.
 */
export function buildRegistration(prefs: Prefs, opts: BuildOptions): PushRegistration | null {
  if (!prefs.alertsEnabled || !prefs.pushEnabled) return null;
  if (!opts.token) return null;

  // Stable order, so two identical sets of preferences hash the same whatever order
  // the toggles were flipped in.
  const kinds = (Object.keys(PUSH_KINDS) as PushKind[])
    .filter((kind) => prefs[PUSH_KINDS[kind]] === true)
    .sort();
  if (!kinds.length) return null;

  const places = prefs.locations.map(toPlace);
  if (!places.length) return null;

  return {
    v: 1,
    token: opts.token,
    platform: opts.platform ?? 'ios',
    kinds,
    places,
    lang: prefs.lang,
    tempUnit: prefs.tempUnit,
    windUnit: prefs.windUnit,
    tzOffsetSec: opts.tzOffsetSec ?? 0,
    quietHours: prefs.quietHours,
    appVersion: opts.appVersion ?? '0',
  };
}

/** A saved location, reduced to what the server needs. Coordinates are rounded to
 *  about a hundred metres: a forecast does not change below that, and a
 *  registration is a thing held on a server. */
function toPlace(l: SavedLocation): PushPlace {
  return { name: l.name, lat: round3(l.lat), lon: round3(l.lon) };
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/**
 * A stable fingerprint of a registration.
 *
 * Only what the server acts on, which is why it is not `JSON.stringify` of the whole
 * thing: the app version changes on every release and would re-register every device
 * for nothing.
 *
 * A string join rather than a hash. It is compared, never stored anywhere space
 * matters, and a join can be read in a log when a registration is not what somebody
 * expected.
 */
export function registrationDigest(reg: PushRegistration | null): string {
  if (!reg) return 'none';
  const places = reg.places.map((p) => `${p.lat},${p.lon}`).join(';');
  return [
    reg.v, reg.token, reg.kinds.join(','), places,
    reg.lang, reg.tempUnit, reg.windUnit, reg.tzOffsetSec, reg.quietHours ? 'q' : '-',
  ].join('|');
}

/** What a sync should do, given what is wanted and what the server was last told. */
export type SyncAction = 'register' | 'unregister' | 'none';

export function syncAction(
  next: PushRegistration | null,
  lastDigest: string | null
): SyncAction {
  const digest = registrationDigest(next);
  if (digest === lastDigest) return 'none';
  return next ? 'register' : lastDigest && lastDigest !== 'none' ? 'unregister' : 'none';
}

/** The transport, injected so the sync can be tested without a network and swapped
 *  for whatever the server ends up speaking. */
export interface PushTransport {
  register(reg: PushRegistration): Promise<void>;
  unregister(token: string): Promise<void>;
}

export interface SyncResult {
  action: SyncAction;
  /** The digest to remember. Unchanged from the last one when nothing was sent, and
   *  unchanged when a send failed — so a failed sync is retried rather than recorded
   *  as done. */
  digest: string;
  ok: boolean;
}

/**
 * Bring the server's idea of this device in line with the preferences.
 *
 * Failure is not fatal and not silent-by-forgetting: the digest is left as it was,
 * so the next run tries again. An app that recorded a failed registration as done
 * would leave someone with a toggle on and no notifications, which is the worst of
 * the three possible states.
 */
export async function syncRegistration(
  next: PushRegistration | null,
  lastDigest: string | null,
  transport: PushTransport,
  lastToken?: string | null
): Promise<SyncResult> {
  const action = syncAction(next, lastDigest);
  const digest = registrationDigest(next);
  if (action === 'none') return { action, digest: lastDigest ?? digest, ok: true };

  try {
    if (action === 'register' && next) await transport.register(next);
    if (action === 'unregister') {
      const token = next?.token ?? lastToken;
      if (token) await transport.unregister(token);
    }
    return { action, digest, ok: true };
  } catch {
    return { action, digest: lastDigest ?? 'none', ok: false };
  }
}

/**
 * An HTTP transport against the contract in `docs/push_contract.md`.
 *
 * `POST /registrations` with the registration as the body, `DELETE
 * /registrations/<token>` to remove it. Both are idempotent by token, so a device
 * that registers twice is one row and a device that unregisters twice is fine.
 */
export function httpTransport(endpoint: string, fetchImpl: typeof fetch = fetch): PushTransport {
  const base = endpoint.replace(/\/+$/, '');
  const check = async (r: Response) => {
    if (!r.ok) throw new Error(`push: HTTP ${r.status}`);
  };
  return {
    async register(reg) {
      await check(
        await fetchImpl(`${base}/registrations`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(reg),
        })
      );
    },
    async unregister(token) {
      await check(
        await fetchImpl(`${base}/registrations/${encodeURIComponent(token)}`, {
          method: 'DELETE',
        })
      );
    },
  };
}

/**
 * Permission to notify at all. Asked at the moment the toggle is turned on rather
 * than at launch, which is both better practice and far more likely to be granted.
 *
 * Imports lazily so `core/` stays free of native modules for the tests.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const Notifications = await import('expo-notifications');
    const existing = await Notifications.getPermissionsAsync();
    return existing.granted || (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * The push token, if one can be had.
 *
 * **Deliberately separate from the permission above, and deliberately allowed to
 * fail.** They answer different questions: permission is whether this phone may show
 * a notification at all, which is what the local fallback needs and all it needs; a
 * token is an address a *server* can deliver to, and is useless until one exists.
 *
 * Conflating them is not hypothetical — it is the bug this split fixes.
 * `getExpoPushTokenAsync` throws without an EAS `projectId`, and the app has none, so
 * a device whose owner had just granted permission was told its notifications were
 * refused and the toggle sprang back. Notifications that work perfectly well were
 * unreachable because the address for a server that does not exist could not be
 * looked up.
 *
 * Null therefore means "no registration can be sent", not "no notifications" — see
 * `buildRegistration`, which already treats a missing token as nothing to register.
 */
export async function requestPushToken(projectId?: string): Promise<string | null> {
  try {
    const Notifications = await import('expo-notifications');
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return token.data ?? null;
  } catch {
    // No EAS project, no network, a simulator: all of them mean the same thing here.
    return null;
  }
}
