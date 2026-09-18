/**
 * The hours the disease models run on, whichever instrument stands at this location.
 *
 * One hook, because the choice between the two is a decision the plan already made and
 * making it twice is how two screens end up disagreeing: **the air at 10 cm where a
 * CropExact stands, the air at 1.50 m otherwise, never both.** `humidHoursFrom` holds
 * the rule; this holds the fetching.
 *
 * A week either way. Smith needs two consecutive days and DIV reads the last two, so a
 * week is enough to see a period build and short enough to be one request.
 */
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSoilCanopyWeek, useAgroSoilStations } from './soilStations';
import { useAgroStations, useStationRange } from './stations';
import { useAgroAuth } from './auth';
import { usePrefs } from './prefs';
import { stationForLocation } from '../core/model/station';
import { soilCapabilities } from '../core/model/soil';
import { agroIntegration } from '../core/prefs';
import {
  AgroAuthError, fetchSoilRange, fetchStationRange, withAgroToken,
} from '../core/sources/agroexact';
import {
  humidHoursFrom, type HumidHour, type HumidSource,
} from '../core/model/humidHours';
import { cropsFor, type LocationCrops } from '../core/model/crops';
import { diseasePressure, type DiseasePressure } from '../core/model/diseasePressure';
import type { SoilStation } from '../core/sources/agroexact';

/** How far back the models look. */
const DISEASE_DAYS = 7;

/** A week of hours changes once an hour at most; ten minutes of reuse costs nothing. */
const DISEASE_STALE_MS = 10 * 60_000;

export interface DiseaseInput {
  /** The weather station speaking for this location, if any. Only its id is used —
   *  the hook asks it for hours and nothing else. */
  station: { id: string } | null;
  /** The soil sensor bound to it, if any. */
  sensor: SoilStation | null;
  offsetSec: number | null;
  /** False while a page is sliding past: a location the reader may not stop on does
   *  not fetch a week of measurements. */
  enabled?: boolean;
}

export interface DiseaseState extends DiseasePressure {
  crops: LocationCrops;
  loading: boolean;
}

/**
 * The disease pressure at one location, fetched and computed.
 *
 * Nothing is fetched where no model applies: a field of onions asks for no hours at
 * all, which on an account of onion sensors is the difference between a page that
 * costs one request and one that costs five.
 */
export interface DiseaseHours {
  hours: HumidHour[];
  source: HumidSource;
  loading: boolean;
}

/**
 * The hours a location's models run on, over whatever window is asked for.
 *
 * Split out so the card's fixed week and the chart's chosen period take the same path.
 * The choice between the two instruments is `humidHoursFrom`'s, made once; this only
 * fetches what that rule may pick from.
 */
export function useDiseaseHours(
  { station, sensor, offsetSec, enabled = true }: DiseaseInput,
  range: { from: string; to: string }
): DiseaseHours {
  const canopy = useSoilCanopyWeek(sensor, offsetSec, enabled, range);

  // The 1.50 m record, from the weather station. A soil-only location has none — the
  // sync never puts a sensor on a station's page — so there the canopy is the only
  // answer, and a BASIC or PLUS field simply has no hours to run on.
  const standardQuery = useStationRange(
    enabled ? station?.id ?? null : null,
    offsetSec,
    range,
    enabled && !!station
  );

  const standard = useMemo<HumidHour[]>(
    () => (standardQuery.data ?? []).map((h) => ({
      time: h.time, humidity: h.humidity, temp: h.temp,
    })),
    [standardQuery.data]
  );

  const picked = useMemo(
    () => humidHoursFrom(standard, canopy.hours),
    [standard, canopy.hours]
  );

  return { ...picked, loading: canopy.loading || standardQuery.isFetching };
}

/** The last week, as the card's window. */
export function useDiseaseWeek(): { from: string; to: string } {
  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.parse(`${today}T12:00:00Z`) - (DISEASE_DAYS - 1) * 86_400_000);
    return { from: from.toISOString().slice(0, 10), to: today };
  }, []);
}

export function useDisease(input: DiseaseInput): DiseaseState {
  const { station, sensor, enabled = true } = input;
  const crops = useMemo(
    () => cropsFor({ sensorCrop: sensor?.crop, hasStation: !!station }),
    [sensor?.crop, station]
  );

  // Only where a model actually applies to something growing here.
  const wanted = enabled && crops.crops.length > 0;
  const range = useDiseaseWeek();
  const { hours, source, loading } = useDiseaseHours({ ...input, enabled: wanted }, range);

  const pressure = useMemo(
    () => diseasePressure({ hours, crops: crops.crops, source }),
    [hours, source, crops.crops]
  );

  return { ...pressure, crops, loading };
}

/**
 * The disease pressure at every saved location, for the overview.
 *
 * A request per location that has something growing on it, and only once the widget is
 * on the page. On an account of onion fields that is no requests at all: the models do
 * not apply, so nothing is asked for.
 *
 * Written as a list of hooks rather than `useQueries` because the work per location is
 * itself two hooks deep — the canopy week and the station week — and React's rules of
 * hooks make a fixed-length map the honest way to do that. The length is
 * `prefs.locations`, which only changes when the reader adds or removes a place.
 */
export interface LocationDisease extends DiseasePressure {
  index: number;
  name: string;
  crops: LocationCrops;
}

export const diseaseKey = (
  stationId: string | null, sensorId: string | null, from: string, to: string
) => ['disease', stationId ?? '', sensorId ?? '', from, to] as const;

/**
 * The disease pressure at every saved location.
 *
 * `useQueries` rather than a hook per location, because the count changes when the
 * reader adds a place and React's rules of hooks do not allow that. The fetching is
 * therefore written out here rather than borrowed from `useDisease`, which is the cost
 * of the rule; the *computing* is still the one shared path, which is the part that
 * would actually drift.
 *
 * **One offset for every location.** The hours are bucketed into local days with the
 * offset of the place the reader is on, not each location's own. Fetching a per-place
 * offset means an extra request per place for a few hours' difference, and every saved
 * location on an AgroExact account is in practice in one zone. Across zones a day
 * boundary would sit a couple of hours out, which can move an hour between days and a
 * count from eleven to ten. Worth knowing; not worth a request per place.
 */
export function useAllLocationDisease(
  offsetSec: number | null,
  enabled: boolean
): LocationDisease[] {
  const { prefs } = usePrefs();
  const auth = useAgroAuth();
  const { data: stations } = useAgroStations();
  const { data: sensors } = useAgroSoilStations();
  const useForCurrent = agroIntegration(prefs).useForCurrentLocation;

  const range = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.parse(`${today}T12:00:00Z`) - (DISEASE_DAYS - 1) * 86_400_000);
    return { from: from.toISOString().slice(0, 10), to: today };
  }, []);

  const places = useMemo(() => prefs.locations.map((location, index) => {
    const sensor = location.soilStationId
      ? sensors?.find((s) => s.id === location.soilStationId) ?? null
      : null;
    const station = stationForLocation(location, stations, useForCurrent);
    return {
      index,
      location,
      sensor,
      station,
      crops: cropsFor({ sensorCrop: sensor?.crop, hasStation: !!station }),
    };
  }), [prefs.locations, sensors, stations, useForCurrent]);

  const results = useQueries({
    queries: places.map(({ sensor, station, crops }) => ({
      queryKey: diseaseKey(station?.id ?? null, sensor?.id ?? null, range.from, range.to),
      // Nothing is fetched where no model applies: an account of onion fields costs
      // no requests at all.
      enabled: enabled && auth.status === 'connected' && crops.crops.length > 0
        && (!!sensor || !!station),
      staleTime: DISEASE_STALE_MS,
      retry: (count: number, error: Error) =>
        !(error instanceof AgroAuthError) && count < 1,
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<HumidHour[]> => {
        const offset = offsetSec ?? 0;

        // The canopy first, where there is one — the plan's own rule, and the same one
        // `humidHoursFrom` applies. Only a PRO has the probe.
        if (sensor && soilCapabilities(sensor.type).canopy) {
          const rows = await withAgroToken(
            auth.getAccessToken,
            (token) => fetchSoilRange(
              token, sensor.id, offset, sensor.depthCm ?? 0, range.from, range.to, { signal }
            ),
            auth.reportUnauthorized
          ).catch(() => null);
          const hours = (rows ?? []).map((r) => ({
            time: r.time, humidity: r.humidity10, temp: r.temp10,
          }));
          if (hours.some((h) => h.humidity != null)) return hours;
        }

        if (!station) return [];
        const rows = await withAgroToken(
          auth.getAccessToken,
          (token) => fetchStationRange(
            token, station.id, offset, range.from, range.to, { signal }
          ),
          auth.reportUnauthorized
        ).catch(() => null);
        return (rows ?? []).map((r) => ({
          time: r.time, humidity: r.humidity, temp: r.temp,
        }));
      },
    })),
  });

  return places.map((place, i) => {
    const hours = results[i]?.data ?? [];
    // The source is decided by what actually came back, not by what was hoped for: a
    // PRO whose probe is silent falls through to the pole and must say so.
    const canopy = !!place.sensor
      && soilCapabilities(place.sensor.type).canopy
      && hours.length > 0
      && !place.station;
    const { hours: used, source } = humidHoursFrom(
      canopy ? [] : hours,
      canopy ? hours : []
    );
    return {
      index: place.index,
      name: place.location.name,
      crops: place.crops,
      ...diseasePressure({ hours: used, crops: place.crops.crops, source }),
    };
  });
}
