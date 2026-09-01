/**
 * Where the device is, as the first page of the location pager.
 *
 * Permission is asked for once, on the first launch that gets this far — not behind
 * a button. An app whose whole subject is the weather where you are standing has an
 * obvious reason to ask, and asking at the moment the reader first sees the app is
 * the moment the reason is clearest. A refusal is final and silent: the arrow goes
 * quiet and the saved places carry on working, and nothing asks again. iOS only
 * shows its own dialog once in any case, so a second request would be a no-op that
 * looked like a broken button.
 *
 * On later launches, a granted permission means the fix is refreshed in the
 * background — the device moves, and a "current location" page that still shows last
 * week's city is worse than no page at all. The refresh never changes which page is
 * being viewed.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import * as Location from 'expo-location';
import { usePrefs } from './prefs';
import { currentLocationIndex } from '../core/prefs';
import { reverseGeocode } from '../core/sources/geocoding';

export type DevicePermission = 'unknown' | 'granted' | 'denied';

interface DeviceLocationValue {
  permission: DevicePermission;
  /** True while a fix is being taken. */
  locating: boolean;
  /** Index of the device's page, or -1 when there is no fix. */
  index: number;
  /** Take a fresh fix, asking for permission if it has not been refused. */
  locate: () => void;
}

const DeviceLocationContext = createContext<DeviceLocationValue | null>(null);

export function DeviceLocationProvider({ children }: { children: ReactNode }) {
  const { prefs, ready, setCurrentLocation } = usePrefs();
  const [permission, setPermission] = useState<DevicePermission>('unknown');
  const [locating, setLocating] = useState(false);
  /** One automatic request per launch, however many times this re-renders. */
  const asked = useRef(false);

  const fix = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status === 'granted' ? 'granted' : 'denied');
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude, prefs.lang);
      setCurrentLocation({ name: place.name, lat: place.lat, lon: place.lon, sub: place.sub });
    } catch {
      // No fix: the saved locations are all still there, which is enough to run on.
    } finally {
      setLocating(false);
    }
  }, [prefs.lang, setCurrentLocation]);

  useEffect(() => {
    if (!ready || asked.current) return;
    asked.current = true;
    void fix();
  }, [ready, fix]);

  const value = useMemo<DeviceLocationValue>(
    () => ({ permission, locating, index: currentLocationIndex(prefs), locate: () => void fix() }),
    [permission, locating, prefs, fix]
  );

  return (
    <DeviceLocationContext.Provider value={value}>{children}</DeviceLocationContext.Provider>
  );
}

export function useDeviceLocation(): DeviceLocationValue {
  const ctx = useContext(DeviceLocationContext);
  if (!ctx) throw new Error('useDeviceLocation must be used inside a DeviceLocationProvider');
  return ctx;
}
