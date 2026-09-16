/**
 * Running a push registration: the parts that touch the device.
 *
 * The decisions are all in `core/push` — what to send, whether anything changed, what
 * to do about it, all pure and all tested. This is what cannot be: the permission
 * prompt, the token, the endpoint out of the app config, and the memory of what the
 * server was last told.
 *
 * Here rather than in `state/` because the background task needs it too, and a task
 * that runs with no React tree should not be reaching into a directory of hooks. The
 * hook that drives it from the app lives in `state/push`.
 *
 * Everything fails soft. A registration that does not go through costs notifications
 * until the next attempt, and the digest is deliberately not advanced on a failure so
 * that there *is* a next attempt.
 */
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  buildRegistration, httpTransport, requestNotificationPermission, requestPushToken,
  syncRegistration, type PushTransport,
} from './push';
import type { Prefs } from './prefs';

/** What the server was last told, so a launch does not re-register every device. */
const DIGEST_KEY = 'exactcast.push.digest.v1';
const TOKEN_KEY = 'exactcast.push.token.v1';

/** Where the registrations go. Absent until a server exists, which is exactly the
 *  state the app ships in today: no endpoint, no request, no error. */
export function pushEndpoint(): string | null {
  const v = Constants.expoConfig?.extra?.pushEndpoint;
  return typeof v === 'string' && v.length ? v : null;
}

function projectId(): string | undefined {
  const eas = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined;
  return eas?.projectId;
}

function appVersion(): string {
  return Constants.expoConfig?.version ?? '0';
}

/**
 * Switch notifications on, for the moment the toggle is tapped.
 *
 * **Permission is the answer; the token is a bonus.** Only a refused prompt returns
 * false, because only that means notifications cannot arrive. A token that cannot be
 * fetched — no EAS project, no network — costs the *server* registration and nothing
 * else, and there is no server yet: the local fallback works on permission alone.
 *
 * Getting this the other way round made the whole feature unreachable. See
 * `requestPushToken`.
 */
export async function enablePush(): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  const token = await requestPushToken(projectId());
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
  return true;
}

/**
 * How an arriving notification behaves while the app is open.
 *
 * Without this, iOS delivers a push to a foregrounded app silently — the handler
 * runs and nothing is shown — which reads as a notification that never arrived. A
 * weather alert is worth a banner even to someone already looking at the app: the
 * shower is not on the screen they happen to be on.
 *
 * No badge. A badge is a count of things waiting to be dealt with, and a shower is
 * not a task; one left on the icon after the rain has passed is a number nobody can
 * clear by doing anything.
 */
export async function configureNotifications(): Promise<void> {
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // No native module (a test run, or a web build): nothing to configure.
  }
}

async function storedToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Run one sync now.
 *
 * Exported as well as used by the hook, so the background task can keep the
 * registration alive on a device whose owner has not opened the app in weeks — a
 * token can be reissued by the system, and a stale one is a device that has quietly
 * stopped receiving anything.
 */
export async function syncPush(prefs: Prefs, transport?: PushTransport): Promise<void> {
  const endpoint = pushEndpoint();
  const wire = transport ?? (endpoint ? httpTransport(endpoint) : null);
  if (!wire) return;

  const token = (await storedToken()) ?? '';
  const last = await AsyncStorage.getItem(DIGEST_KEY).catch(() => null);

  const next = buildRegistration(prefs, {
    token,
    platform: Platform.OS === 'android' ? 'android' : 'ios',
    // The device's own offset. The server writes "over 20 minuten" against the
    // reader's clock, and enforces quiet hours against it.
    tzOffsetSec: -new Date().getTimezoneOffset() * 60,
    appVersion: appVersion(),
  });

  const result = await syncRegistration(next, last, wire, token);
  if (result.action === 'none') return;
  if (result.ok) await AsyncStorage.setItem(DIGEST_KEY, result.digest).catch(() => {});
}
