/**
 * Keeping the widget in step with the app.
 *
 * Writes the payload into the shared App Group container and asks WidgetKit to
 * reload. Because the payload is built from the same `ForecastModel` the screens
 * render, the widget cannot show a different forecast than the app.
 *
 * Everything here fails soft: a widget that does not update is a much smaller
 * problem than an app that crashes trying to update it.
 */
import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { ExtensionStorage } from '@bacons/apple-targets';
import { buildWidgetPayload } from '../core/widget';
import type { ForecastModel } from '../core/model/types';
import type { WeatherAlert } from '../core/model/alert';
import type { Prefs, SavedLocation } from '../core/prefs';

const PAYLOAD_KEY = 'exactcast.widget.payload';
const WIDGET_KIND = 'ExactCastWidget';

function appGroup(): string {
  return (
    (Constants.expoConfig?.extra?.appGroup as string | undefined) ??
    'group.com.agroexact.exactcast'
  );
}

let storage: ExtensionStorage | null = null;
function store(): ExtensionStorage | null {
  if (storage) return storage;
  try {
    storage = new ExtensionStorage(appGroup());
    return storage;
  } catch {
    // No App Group entitlement (a simulator build without provisioning, say).
    return null;
  }
}

export interface SyncInput {
  model: ForecastModel | null;
  prefs: Prefs;
  location: SavedLocation;
  alert?: WeatherAlert | null;
  nowcastBars?: number[];
}

export function writeWidgetPayload({
  model, prefs, location, alert, nowcastBars,
}: SyncInput): boolean {
  if (!model) return false;
  const s = store();
  if (!s) return false;
  try {
    const payload = buildWidgetPayload({ model, prefs, location, alert, nowcastBars });
    s.set(PAYLOAD_KEY, JSON.stringify(payload));
    ExtensionStorage.reloadWidget(WIDGET_KIND);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mirror the current forecast into the widget whenever it changes.
 *
 * Writes are debounced: the staged load updates the model three times in the first
 * few seconds, and reloading WidgetKit timelines on each would be wasteful.
 */
export function useWidgetSync(input: SyncInput): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { model, prefs, location, alert, nowcastBars } = input;

  useEffect(() => {
    if (!model) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      writeWidgetPayload({ model, prefs, location, alert, nowcastBars });
    }, 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [model, prefs, location, alert, nowcastBars]);
}
