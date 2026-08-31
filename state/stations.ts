/**
 * AgroExact station list.
 *
 * Loaded once per session and cached for a week, matching the web app's policy —
 * the station network changes rarely, and refetching it on every map open would be
 * wasteful and rate-limited.
 *
 * Returns nothing at all when the integration is switched off or no token is
 * stored, so the Radar screen simply has no station pins rather than an error.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchStations, nearestStation, distanceKm, agroBaseUrl,
  AGRO_MAX_DISTANCE_KM, type AgroStation, type NearestStation,
} from '../core/sources/agroexact';
import { usePrefs } from './prefs';

const CACHE_KEY = 'exactcast.agro.stations.v1';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface Cache {
  ts: number;
  base: string;
  stations: AgroStation[];
}

export interface StationsState {
  stations: AgroStation[];
  /** The nearest station, whatever the distance. */
  nearest: NearestStation | null;
  /** The nearest station only when it is close enough to speak for this location. */
  usable: NearestStation | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useStations(lat: number, lon: number): StationsState {
  const { prefs, getAgroToken } = usePrefs();
  const [stations, setStations] = useState<AgroStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const enabled = prefs.agroExact;
  const base = agroBaseUrl({ token: '', baseUrl: prefs.agroBase });

  useEffect(() => {
    if (!enabled) {
      setStations([]);
      setError(null);
      return;
    }
    let alive = true;
    const ctrl = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);

      // A cache from a different base URL is not this network's station list.
      if (nonce === 0) {
        try {
          const raw = await AsyncStorage.getItem(CACHE_KEY);
          if (raw) {
            const c = JSON.parse(raw) as Cache;
            if (c.base === base && Date.now() - c.ts < CACHE_MAX_AGE_MS && Array.isArray(c.stations)) {
              if (alive) {
                setStations(c.stations);
                setLoading(false);
              }
              return;
            }
          }
        } catch {
          // A bad cache is simply a miss.
        }
      }

      const token = await getAgroToken();
      if (!token) {
        if (alive) {
          setStations([]);
          setLoading(false);
          setError('Geen API-token');
        }
        return;
      }

      try {
        const list = await fetchStations({ token, baseUrl: prefs.agroBase }, { signal: ctrl.signal });
        if (!alive) return;
        setStations(list);
        AsyncStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ ts: Date.now(), base, stations: list } satisfies Cache)
        ).catch(() => {});
      } catch (e) {
        if (alive) setError((e as Error)?.message ?? 'Stations laden mislukt');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [enabled, base, prefs.agroBase, getAgroToken, nonce]);

  const reload = useCallback(() => {
    AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
    setNonce((n) => n + 1);
  }, []);

  const nearest = stations.length ? nearestStation(stations, lat, lon) : null;
  const usable = nearest && nearest.dist <= AGRO_MAX_DISTANCE_KM ? nearest : null;

  return { stations, nearest, usable, loading, error, reload };
}

/** Stations within `km` of a point, for the map pins. */
export function stationsNear(
  stations: readonly AgroStation[],
  lat: number,
  lon: number,
  km: number
): AgroStation[] {
  return stations.filter((s) => distanceKm(lat, lon, s.lat, s.lon) <= km);
}
