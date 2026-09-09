/**
 * Every saved location's current conditions, for the comparison sheet on 'Actueel'.
 *
 * The rest of the app is built around one location at a time: the pager picks it,
 * the forecast context loads it, and the two locations either side are prefetched so
 * a swipe has something to land on. This is the one place that asks about all of
 * them at once — tapping a block on 'Actueel' asks "and what is it doing everywhere
 * else", and the answer is a row per saved place.
 *
 * ## Why it is not the forecast cache
 *
 * That cache holds three locations at most and only ones the reader has been to or
 * swiped past, so a list built from it would be mostly blank in exactly the case
 * this sheet exists for. And the models in it are the full staged build — fourteen
 * days of ensemble percentiles — which is a great deal of work for twelve current
 * readings.
 *
 * So each location is loaded from the observation feed alone: one request, covering
 * yesterday and today, which is precisely the window the blocks are computed over.
 * `processAll` builds a model from it with no forecast call at all, and a station
 * location then has its own measurements merged over the top exactly as the page in
 * front does — so a station reads the same number in the sheet as it does on its own
 * page, which is the whole point of a comparison.
 *
 * ## Why the rows arrive one at a time
 *
 * One query per location rather than one for the list, so a slow or failing location
 * costs its own row and not the sheet. TanStack caches them individually too, which
 * means the location the reader is standing on is usually already there, and opening
 * a second block a moment later costs nothing.
 */
import { useQueries } from '@tanstack/react-query';
import { processAll } from '../core/model/process';
import { applyStationObservations, stationForLocation } from '../core/model/station';
import { loadObservations } from '../core/sources/openMeteo';
import {
  AgroAuthError, fetchStationObservations, withAgroToken,
} from '../core/sources/agroexact';
import { agroIntegration, type SavedLocation } from '../core/prefs';
import type { ForecastModel } from '../core/model/types';
import { useAgroStations } from './stations';
import { useAgroAuth } from './auth';
import { usePrefs } from './prefs';

/** Conditions age by the hour, and a station reports every ten minutes. */
const CONDITIONS_STALE_MS = 5 * 60_000;

export const conditionsKey = (lat: number, lon: number, stationId: string | null) =>
  ['conditions', lat.toFixed(4), lon.toFixed(4), stationId ?? ''] as const;

export interface LocationConditions {
  location: SavedLocation;
  /** Null while loading, and after a load that failed. */
  model: ForecastModel | null;
  /** True where an AgroExact station speaks for this location. */
  hasStation: boolean;
  loading: boolean;
}

/**
 * Current conditions for every saved location.
 *
 * `enabled` is false until the sheet opens: this is a request per saved place, and
 * nothing should pay for it while the grid alone is on screen.
 */
export function useAllLocationConditions(enabled: boolean): LocationConditions[] {
  const { prefs } = usePrefs();
  const auth = useAgroAuth();
  const { data: stations } = useAgroStations();
  const useForCurrent = agroIntegration(prefs).useForCurrentLocation;

  const results = useQueries({
    queries: prefs.locations.map((l) => {
      const station = stationForLocation(l, stations, useForCurrent);
      return {
        queryKey: conditionsKey(l.lat, l.lon, station?.id ?? null),
        enabled,
        staleTime: CONDITIONS_STALE_MS,
        retry: (count: number, error: Error) =>
          !(error instanceof AgroAuthError) && count < 1,
        queryFn: async ({ signal }: { signal: AbortSignal }): Promise<ForecastModel | null> => {
          const observations = await loadObservations({ lat: l.lat, lon: l.lon }, { signal });
          const model = processAll(observations, null, null, null, null, null, {
            lat: l.lat,
            lon: l.lon,
            // No forecast call was made, so there is no HARMONIE to prefer or to
            // have failed. Everything these blocks read comes from the feed above.
            useHarmonie: false,
            harmFailed: false,
          });
          if (!model || !station || auth.status !== 'connected') return model;

          // The feed's own offset, not the device's: a Dutch station's hours have to
          // bucket into Dutch hours on a phone set to another zone.
          const offsetSec = observations?.utc_offset_seconds ?? 0;
          const obs = await withAgroToken(
            auth.getAccessToken,
            (token) => fetchStationObservations(token, station.id, offsetSec, { signal }),
            auth.reportUnauthorized
          ).catch(() => null);
          return applyStationObservations(model, obs);
        },
      };
    }),
  });

  return prefs.locations.map((location, i) => {
    const q = results[i];
    return {
      location,
      model: q?.data ?? null,
      hasStation: !!stationForLocation(location, stations, useForCurrent),
      loading: !!q?.isLoading,
    };
  });
}
