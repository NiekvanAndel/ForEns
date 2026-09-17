/**
 * Background refresh.
 *
 * Fetches the forecast while the app is not open, so the widget is current when
 * someone glances at their home screen and so weather alerts can fire without the
 * app having been launched.
 *
 * The honest limitation: iOS decides when — and whether — a background task runs.
 * `BGTaskScheduler` typically grants a window every few hours, learned from usage,
 * and never at a guaranteed interval. So "uiterlijk 20 minuten vooraf" in the
 * design's notification copy is not something local scheduling can promise. Real
 * push would need a server, which is out of scope; see DEFERRED.md.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadStage1, loadStage2 } from './sources/openMeteo';
import { processAll } from './model/process';
import { deriveAlert } from './model/alert';
import { activeProvider } from './radar';
import {
  planNotification, planUserAlertNotification, scheduleNotification,
} from './notifications';
import { fetchAlertReadings } from './alertFetch';
import { runUserAlerts, sanitiseStates } from './alertRun';
import { syncPush } from './pushSync';
import { mergePrefs, activeLocation, type Prefs } from './prefs';

export const REFRESH_TASK = 'com.agroexact.exactcast.refresh';
const PREFS_KEY = 'exactcast.prefs.v1';
/** Which of the reader's own rules were tripped at the last run, so a standing
 *  condition notifies once rather than every half hour. Not in preferences: it is
 *  bookkeeping, and it would re-register the device on every shower. */
const ALERT_STATE_KEY = 'exactcast.alertState.v1';

/** Injected by the app so the task can write the widget payload without this
 *  module depending on a native target helper. */
type WidgetWriter = (args: {
  model: ReturnType<typeof processAll>;
  prefs: Prefs;
  location: ReturnType<typeof activeLocation>;
  alert: ReturnType<typeof deriveAlert>;
  nowcastBars?: number[];
}) => void;

let writeWidget: WidgetWriter | null = null;
export function setWidgetWriter(fn: WidgetWriter): void {
  writeWidget = fn;
}

/** Read preferences directly: the task runs with no React tree and no context. */
async function readPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return mergePrefs(raw ? JSON.parse(raw) : null);
  } catch {
    return mergePrefs(null);
  }
}

TaskManager.defineTask(REFRESH_TASK, async () => {
  try {
    const prefs = await readPrefs();
    const location = activeLocation(prefs);
    const coords = { lat: location.lat, lon: location.lon };

    const s1 = await loadStage1(coords, prefs.useHarmonie);
    if (!s1.observations && !s1.hourly) return BackgroundTask.BackgroundTaskResult.Failed;

    // Only the deterministic run is fetched here. The 51-member ensemble is far
    // too heavy for a background window, and nothing the widget shows needs it.
    const s2 = await loadStage2(coords);

    const model = processAll(s1.observations, s1.hourly, null, s2.ifs, s2.ifs, s2.ifs, {
      lat: coords.lat,
      lon: coords.lon,
      useHarmonie: prefs.useHarmonie,
      harmFailed: s1.harmonie.failed,
      ecmwfHourly: s2.icons,
    });
    if (!model) return BackgroundTask.BackgroundTaskResult.Failed;

    let bars: number[] | undefined;
    let profile = null;
    try {
      profile = await activeProvider().nowcastProfile(coords.lat, coords.lon);
      bars = profile.bars.map((b) => Math.round(b.height));
    } catch {
      // The widget simply shows no nowcast bars.
    }

    // The same gate the app applies, so a widget refreshed in the background cannot
    // show a block the app has been told not to show.
    const alert = prefs.alertsEnabled
      ? deriveAlert(model, profile, {
          lang: prefs.lang, tempUnit: prefs.tempUnit, windUnit: prefs.windUnit,
        })
      : null;

    writeWidget?.({ model, prefs, location, alert, nowcastBars: bars });

    const plan = planNotification(alert, prefs, {
      locationName: location.name,
      tzOffsetSec: s1.offsetSec,
    });
    if (plan) await scheduleNotification(plan);

    await runOwnRules(prefs, s1.offsetSec, model.nowHour);

    // A token can be reissued by the system, and a device that has not opened the
    // app in weeks would otherwise be registered under one the server can no longer
    // deliver to. A no-op until an endpoint is configured.
    await syncPush(prefs).catch(() => {});

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Register the task. iOS treats the interval as a hint, not a schedule. */
export async function registerBackgroundRefresh(): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(REFRESH_TASK);
    if (registered) return;
    await BackgroundTask.registerTaskAsync(REFRESH_TASK, { minimumInterval: 30 });
  } catch {
    // Unavailable in the simulator and when Background App Refresh is switched off.
  }
}

export async function unregisterBackgroundRefresh(): Promise<void> {
  try {
    await BackgroundTask.unregisterTaskAsync(REFRESH_TASK);
  } catch {
    /* nothing registered */
  }
}


/**
 * The reader's own thresholds, evaluated against the stations they name.
 *
 * Separate from the task body because it is a different job with a different failure
 * mode: the forecast above is for the widget and must run, and this needs an
 * AgroExact account most devices do not have. It fails soft all the way down — no
 * account, no token, no rules, a station that would not answer: each of those is a
 * run that does nothing, never a run that fails.
 *
 * The state file is read and written whole. A rule deleted between runs simply stops
 * appearing in it, which is what keeps it from growing for ever.
 */
async function runOwnRules(prefs: Prefs, offsetSec: number, nowKey: string): Promise<void> {
  const alerts = prefs.userAlerts.filter((a) => a.enabled);
  if (!alerts.length) return;

  const { readings, ok } = await fetchAlertReadings(alerts, offsetSec, nowKey);
  // Nothing could be read. Leave every rule's memory exactly as it was: a run that
  // could not see is not a run that saw nothing wrong, and clearing here would make
  // the next successful run notify about a condition that never went away.
  if (!ok) return;

  let previous = {};
  try {
    const raw = await AsyncStorage.getItem(ALERT_STATE_KEY);
    previous = sanitiseStates(raw ? JSON.parse(raw) : null, alerts);
  } catch {
    // An unreadable state file costs one round of over-notifying, not the run.
  }

  const { fired, states } = runUserAlerts(alerts, readings, previous);

  for (const tripped of fired) {
    const plan = planUserAlertNotification(tripped, prefs, { locationName: '', tzOffsetSec: offsetSec });
    if (plan) await scheduleNotification(plan);
  }

  await AsyncStorage.setItem(ALERT_STATE_KEY, JSON.stringify(states)).catch(() => {});
}
