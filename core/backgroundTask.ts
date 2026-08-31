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
import { loadStage1, loadStage2, loadEnsemble } from './sources/openMeteo';
import { processAll } from './model/process';
import { deriveAlert } from './model/alert';
import { activeProvider } from './radar';
import { planNotification, scheduleNotification } from './notifications';
import { mergePrefs, activeLocation, type Prefs } from './prefs';

export const REFRESH_TASK = 'com.agroexact.exactcast.refresh';
const PREFS_KEY = 'exactcast.prefs.v1';

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

    const alert = deriveAlert(model, profile);

    writeWidget?.({ model, prefs, location, alert, nowcastBars: bars });

    const plan = planNotification(alert, prefs, {
      locationName: location.name,
      tzOffsetSec: s1.offsetSec,
    });
    if (plan) await scheduleNotification(plan);

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
