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
 * days of ensemble percentiles — which is a great deal of work for a dozen current
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
import { activeProvider, type NowcastProfile } from '../core/radar';
import {
  applySoilPrecip, applyStationObservations, precipIsMeasured, stationForLocation,
  type SoilObservations,
} from '../core/model/station';
import { loadObservations } from '../core/sources/openMeteo';
import { fetchOutlook } from '../core/sources/outlook';
import { fetchEnsembleOutlook, type EnsembleOutlook } from '../core/sources/ensembleOutlook';
import type { LocationOutlook } from '../core/overviewData';
import {
  AgroAuthError, fetchSoilHours, fetchStationObservations, withAgroToken,
} from '../core/sources/agroexact';
import { agroIntegration, type SavedLocation } from '../core/prefs';
import type { ForecastModel } from '../core/model/types';
import { useAgroStations } from './stations';
import { useAgroSoilStations } from './soilStations';
import { useAgroAuth } from './auth';
import { usePrefs } from './prefs';

/** Conditions age by the hour, and a station reports every ten minutes. */
const CONDITIONS_STALE_MS = 5 * 60_000;

export const conditionsKey = (
  lat: number, lon: number, stationId: string | null, soilStationId: string | null
) => ['conditions', lat.toFixed(4), lon.toFixed(4), stationId ?? '', soilStationId ?? ''] as const;

/** What one location's query answers with: the model, and whether its rain is real. */
interface Conditions {
  model: ForecastModel | null;
  precipMeasured: boolean;
}

export interface LocationConditions {
  location: SavedLocation;
  /** Null while loading, and after a load that failed. */
  model: ForecastModel | null;
  /** True where an AgroExact station speaks for this location. */
  hasStation: boolean;
  /**
   * Whether an instrument answered for the rainfall here.
   *
   * Carried beside the model rather than on it, exactly as the page's own forecast
   * does: a soil sensor's rain is merged into the hours and leaves no `station`
   * overlay behind, because that overlay is what a hero reads to put a measurement
   * time beside a temperature.
   */
  precipMeasured: boolean;
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
  const { data: soilSensors } = useAgroSoilStations();
  const useForCurrent = agroIntegration(prefs).useForCurrentLocation;

  const results = useQueries({
    queries: prefs.locations.map((l) => {
      const station = stationForLocation(l, stations, useForCurrent);
      const sensor = l.soilStationId
        ? soilSensors?.find((s) => s.id === l.soilStationId) ?? null
        : null;
      return {
        queryKey: conditionsKey(l.lat, l.lon, station?.id ?? null, sensor?.id ?? null),
        enabled,
        staleTime: CONDITIONS_STALE_MS,
        retry: (count: number, error: Error) =>
          !(error instanceof AgroAuthError) && count < 1,
        queryFn: async ({ signal }: { signal: AbortSignal }): Promise<Conditions> => {
          const observations = await loadObservations({ lat: l.lat, lon: l.lon }, { signal });
          const model = processAll(observations, null, null, null, null, null, {
            lat: l.lat,
            lon: l.lon,
            // No forecast call was made, so there is no HARMONIE to prefer or to
            // have failed. Everything these blocks read comes from the feed above.
            useHarmonie: false,
            harmFailed: false,
          });
          if (!model || auth.status !== 'connected') return { model, precipMeasured: false };

          // The feed's own offset, not the device's: a Dutch station's hours have to
          // bucket into Dutch hours on a phone set to another zone.
          const offsetSec = observations?.utc_offset_seconds ?? 0;

          const obs = station
            ? await withAgroToken(
                auth.getAccessToken,
                (token) => fetchStationObservations(token, station.id, offsetSec, { signal }),
                auth.reportUnauthorized
              ).catch(() => null)
            : null;

          // The soil sensor's rain, on the same terms as the page's own model — rain
          // and irrigation are one number, and a sheet that compared a modelled
          // figure against the merged one on the page behind it would be showing two
          // answers to the same question.
          const soilHours = sensor
            ? await withAgroToken(
                auth.getAccessToken,
                (token) => fetchSoilHours(
                  token, sensor.id, offsetSec, sensor.depthCm ?? 0, 26, { signal }
                ),
                auth.reportUnauthorized
              ).catch(() => null)
            : null;

          const soil: SoilObservations | null = sensor
            ? {
                stationId: sensor.id,
                stationName: sensor.name,
                type: sensor.type,
                hours: soilHours?.hours ?? {},
              }
            : null;

          const merged = applySoilPrecip(applyStationObservations(model, obs), soil);
          return { model: merged, precipMeasured: precipIsMeasured(merged, soil) };
        },
      };
    }),
  });

  return prefs.locations.map((location, i) => {
    const q = results[i];
    return {
      location,
      model: q?.data?.model ?? null,
      hasStation: !!stationForLocation(location, stations, useForCurrent),
      precipMeasured: q?.data?.precipMeasured ?? false,
      loading: !!q?.isLoading,
    };
  });
}


/**
 * The radar nowcast for every saved location.
 *
 * Its own hook, and its own set of queries, because it is only ever wanted for one
 * of the fourteen blocks. Two hours of five-minutely data per place is heavier than
 * the observation feed above, so it is not fetched alongside it and paid for by
 * every other block's comparison — the sheet turns it on only when the block being
 * compared is the one that reads it.
 *
 * A location outside the radar run's coverage gets null, which the block draws as a
 * dash. Falling back to the weather model's own rainfall for that hour would be a
 * quieter answer and the wrong one: the whole point of this block is that the
 * nowcast is a sharper source over the next hour, so a row that silently swapped in
 * the model would be comparing two different forecasts down one column.
 */
export function useAllLocationNowcasts(enabled: boolean): (NowcastProfile | null)[] {
  const { prefs } = usePrefs();

  const results = useQueries({
    queries: prefs.locations.map((l) => ({
      queryKey: ['nowcast', l.lat.toFixed(4), l.lon.toFixed(4)] as const,
      enabled,
      staleTime: CONDITIONS_STALE_MS,
      retry: 1,
      queryFn: ({ signal }: { signal: AbortSignal }): Promise<NowcastProfile | null> =>
        activeProvider()
          .nowcastProfile(l.lat, l.lon, signal)
          .catch(() => null),
    })),
  });

  return prefs.locations.map((_, i) => results[i]?.data ?? null);
}


/** An outlook is a forecast run; within the hour it is the same answer. */
const OUTLOOK_STALE_MS = 30 * 60_000;

export const outlookKey = (lat: number, lon: number) =>
  ['outlook', lat.toFixed(3), lon.toFixed(3)] as const;

/**
 * A short forecast for every saved location, for the overview page.
 *
 * The third of these hooks and the same shape as the other two: one query per
 * location so a slow one costs its own row, and `enabled` so nothing is fetched for a
 * widget the reader has switched off. See `neededSources`, which is what decides that.
 *
 * The conditions hook above answers "what was it and what is it" from the observation
 * feed. This is the "what will it be" half, and it is separate because most of the
 * page does not need it — the rainfall ranking, the alerts and the current readings
 * all come from the other one.
 */
export function useAllLocationOutlooks(enabled: boolean): (LocationOutlook | null)[] {
  const { prefs } = usePrefs();

  const results = useQueries({
    queries: prefs.locations.map((l) => ({
      queryKey: outlookKey(l.lat, l.lon),
      enabled,
      staleTime: OUTLOOK_STALE_MS,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchOutlook({ lat: l.lat, lon: l.lon }, { signal }),
    })),
  });

  return prefs.locations.map((_, i) => results[i]?.data ?? null);
}


/** An ensemble run lands a few times a day; within the hour it is the same answer. */
const ENSEMBLE_STALE_MS = 60 * 60_000;

export const ensembleOutlookKey = (lat: number, lon: number) =>
  ['ensemble-outlook', lat.toFixed(3), lon.toFixed(3)] as const;

/**
 * How much the members disagree about each saved location's coming rain.
 *
 * The fourth of these hooks and the heaviest per response, which is why it is its own
 * source in `OVERVIEW_WIDGETS` and only fetched for the widget that reads it. Nothing
 * else on the page needs it: the rankings and the outlook are deterministic runs, and
 * this is the qualifier on them.
 */
export function useAllLocationEnsembles(enabled: boolean): (EnsembleOutlook | null)[] {
  const { prefs } = usePrefs();

  const results = useQueries({
    queries: prefs.locations.map((l) => ({
      queryKey: ensembleOutlookKey(l.lat, l.lon),
      enabled,
      staleTime: ENSEMBLE_STALE_MS,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchEnsembleOutlook({ lat: l.lat, lon: l.lon }, { signal }),
    })),
  });

  return prefs.locations.map((_, i) => results[i]?.data ?? null);
}
