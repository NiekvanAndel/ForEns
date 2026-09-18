/**
 * The account's soil sensors, and what the nearest one is reporting.
 *
 * Kept apart from `state/stations.ts` because a soil sensor is not a weather station
 * with different fields on it. A pole stands in one place for years and becomes a
 * location; a soil sensor is station × field × crop × soil × depth × season, and its
 * history belongs to the field rather than to the device — see `core/model/soil`. The
 * two will need different syncs, and starting them in one file would mean pulling them
 * apart again at the first placement.
 *
 * This is the first thing in the app that actually calls the soil endpoints. It is
 * deliberately small: the list, and one sensor's latest reading. Everything the plan
 * builds on top — blocks on 'Actueel', series on 'Grafiek', the placement segments —
 * needs to know first that measurements arrive at all.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AgroAuthError, distanceKm, fetchLatestSoilMeasurement, fetchSoilHours, fetchSoilRange,
  fetchSoilReadings, fetchSoilStations, withAgroToken,
  type SoilSample, type SoilStation,
} from '../core/sources/agroexact';
import { isDormant, placementFromStation } from '../core/model/soil';
import type { SoilObservations } from '../core/model/station';
import { syncSoilLocations, type SavedLocation } from '../core/prefs';
import { useAgroAuth } from './auth';
import { usePrefs } from './prefs';

/** Sensors are added and moved by hand in the web app; an hour between fetches is
 *  as generous here as it is for the weather stations. */
const SOIL_STATIONS_STALE_MS = 60 * 60_000;
/** A soil sensor reports about every thirty minutes, so a quarter of an hour of
 *  reuse never costs a reading. */
const SOIL_READING_STALE_MS = 15 * 60_000;

export const soilStationsKey = ['agroexact', 'soilstations'] as const;
export const soilLatestKey = (stationId: string) =>
  ['agroexact', 'soil-latest', stationId] as const;

/**
 * The soil sensors linked to the signed-in account.
 *
 * Empty rather than an error when nobody is signed in, exactly as `useAgroStations`
 * does: every caller has a perfectly good page to draw without sensors.
 */
export function useAgroSoilStations() {
  const auth = useAgroAuth();

  return useQuery({
    queryKey: soilStationsKey,
    enabled: auth.status === 'connected',
    staleTime: SOIL_STATIONS_STALE_MS,
    queryFn: async ({ signal }): Promise<SoilStation[]> => {
      const rows = await withAgroToken(
        auth.getAccessToken,
        (token) => fetchSoilStations(token, { signal }),
        auth.reportUnauthorized
      );
      return rows ?? [];
    },
    retry: (count, error) => !(error instanceof AgroAuthError) && count < 2,
  });
}

/** What one sensor is reporting, and whether it is in the ground at all. */
export interface NearestSoil {
  station: SoilStation;
  /** Great-circle distance from the point asked about, km. */
  dist: number;
  /** Null while the reading is still in flight, and when there is none to have. */
  latest: SoilSample | null;
  /** Out of the ground rather than broken — fourteen days without a measurement. */
  dormant: boolean;
  loading: boolean;
}

/**
 * The sensor nearest a point, and its latest reading.
 *
 * One sensor, one call. The account has over a thousand of them and asking each for
 * its state would be a thousand requests to answer a question one of them settles.
 *
 * No radius: a sensor eighty kilometres away is reported as being eighty kilometres
 * away rather than hidden behind a threshold this app would have had to invent. The
 * distance is the answer to "is this mine", and the reader is better at it than a
 * constant would be.
 */
export function useNearestSoilSensor(lat: number | null, lon: number | null): NearestSoil | null {
  const auth = useAgroAuth();
  const { data: stations } = useAgroSoilStations();

  const nearest = useMemo(() => {
    if (lat == null || lon == null || !stations?.length) return null;
    let best: { station: SoilStation; dist: number } | null = null;
    for (const s of stations) {
      const dist = distanceKm(lat, lon, s.lat, s.lon);
      if (!best || dist < best.dist) best = { station: s, dist };
    }
    return best;
  }, [stations, lat, lon]);

  const query = useQuery({
    queryKey: soilLatestKey(nearest?.station.id ?? ''),
    enabled: auth.status === 'connected' && !!nearest,
    staleTime: SOIL_READING_STALE_MS,
    queryFn: async ({ signal }): Promise<SoilSample | null> => {
      if (!nearest) return null;
      const out = await withAgroToken(
        auth.getAccessToken,
        (token) => fetchLatestSoilMeasurement(
          token,
          nearest.station.id,
          // The row shows the measurement's own timestamp in the reader's zone, so
          // the local hour key this would bucket into is not used and the offset
          // does not matter. Anything drawing a series must pass the real one.
          0,
          nearest.station.depthCm ?? 0,
          { signal }
        ),
        auth.reportUnauthorized
      );
      return out?.current ?? null;
    },
    retry: (count, error) => !(error instanceof AgroAuthError) && count < 2,
  });

  if (!nearest) return null;
  return {
    station: nearest.station,
    dist: nearest.dist,
    latest: query.data ?? null,
    // No reading at all is the same answer as a very old one: the sensor is not in
    // the ground. It is a state, not a fault, and nothing here reports it as one.
    dormant: !query.isFetching && isDormant(query.data?.measTime ?? null),
    loading: query.isFetching,
  };
}

/** Refetch the soil sensor list now, alongside the station refresh in Instellingen. */
export function useRefreshSoilStations() {
  const client = useQueryClient();
  return useCallback(
    () => client.invalidateQueries({ queryKey: soilStationsKey }),
    [client]
  );
}

/**
 * The soil sensor bound to a location, as a placement and its latest reading.
 *
 * The binding is `SavedLocation.soilStationId`, written by `syncSoilLocations` — a
 * sensor within two hundred metres of a place is on that place, and anything further
 * is its own. So this looks the sensor up by id rather than by distance: the decision
 * was already made, and making it twice invites the two answers to differ.
 *
 * Null all the way down is the ordinary case. Most locations have no soil sensor, and
 * a page that has none simply draws no soil blocks.
 */
export function useLocationSoil(
  location: { soilStationId?: string } | null,
  /**
   * The location's own UTC offset, from the forecast.
   *
   * Not optional in spirit: the sample's `time` is bucketed with it, and anything
   * comparing that key against the model's `nowHour` — which is a local key — needs
   * the two on the same clock. Bucketing on UTC puts a reading west of Greenwich in
   * the future, where `buildIndicator` will not count it as the current state and the
   * card loses its bar. Zero is the honest default for a caller that has no offset
   * yet, and such a caller is not comparing keys.
   */
  offsetSec = 0
) {
  const auth = useAgroAuth();
  const { data: sensors } = useAgroSoilStations();
  const id = location?.soilStationId ?? null;

  const station = useMemo(
    () => (id ? sensors?.find((s) => s.id === id) ?? null : null),
    [sensors, id]
  );

  const query = useQuery({
    queryKey: [...soilLatestKey(id ?? ''), offsetSec],
    enabled: auth.status === 'connected' && !!station,
    staleTime: SOIL_READING_STALE_MS,
    queryFn: async ({ signal }): Promise<SoilSample | null> => {
      if (!station) return null;
      const out = await withAgroToken(
        auth.getAccessToken,
        (token) => fetchLatestSoilMeasurement(
          token, station.id, offsetSec, station.depthCm ?? 0, { signal }
        ),
        auth.reportUnauthorized
      );
      return out?.current ?? null;
    },
    retry: (count, error) => !(error instanceof AgroAuthError) && count < 2,
  });

  const latest = query.data ?? null;

  const placement = useMemo(() => {
    if (!station || !latest) return null;
    return placementFromStation(
      {
        id: station.id, name: station.name, lat: station.lat, lon: station.lon,
        crop: station.crop, depthCm: station.depthCm, thresholds: station.thresholds,
      },
      // The oldest moment there is evidence for. Without `/soilstations/{id}/placements/`
      // the app cannot know when this placement began, which is exactly what the
      // `assumed` flag on it says. Only the segment splitting of step 4b needs a true
      // start, and it must not be built on this.
      latest.measTime
    );
  }, [station, latest]);

  return { station, placement, latest, loading: query.isFetching };
}

/**
 * Keep the saved locations in step with the account's soil sensors.
 *
 * The counterpart of `useStationLocationSync`, and kept separate for the same reason
 * the rest of this file is: the two reconcile different instruments and would
 * otherwise delete each other's locations.
 *
 * No reverse lookup, so no rate limit and no sequencing: a field is called by its own
 * name. That is also the better name — four fields around one village would otherwise
 * all be called after the village.
 *
 * A failed fetch never reaches here, so a sensor can only be absent because the
 * account no longer has it.
 */
export function useSoilLocationSync() {
  const { prefs, mutate } = usePrefs();
  const { data: sensors } = useAgroSoilStations();
  const { status } = useAgroAuth();
  /** Sensor sets already reconciled this session, so a re-render cannot redo it. */
  const done = useRef<string>('');

  useEffect(() => {
    if (status !== 'connected' || !sensors) return;
    // The sensors, and the places they could be coupled to. The second half matters:
    // the station sync may land after this one, and a sensor that made its own page
    // for want of a host has to be reconsidered once the host appears.
    const hosts = prefs.locations
      .filter((l) => !l.soilStationId && !l.stationId)
      .map((l) => `${l.lat.toFixed(4)},${l.lon.toFixed(4)}`)
      .sort()
      .join(';');
    const fingerprint = `${sensors
      .map((s) => `${s.id}@${s.lat.toFixed(5)},${s.lon.toFixed(5)}`)
      .sort()
      .join(',')}|${hosts}`;
    if (done.current === fingerprint) return;
    done.current = fingerprint;

    mutate((p) => syncSoilLocations(p, sensors.map((s) => ({
      stationId: s.id,
      stationName: s.name,
      lat: s.lat,
      lon: s.lon,
    }))));
  }, [sensors, status, mutate, prefs.locations]);
}

export const soilRangeKey = (
  stationId: string, offsetSec: number, from: string, to: string, fine: boolean
) => ['agroexact', 'soil-range', stationId, offsetSec, from, to, fine] as const;

/** A window of soil readings is worth reusing for a few minutes; the sensor reports
 *  every half hour and the reader is switching pills, not waiting for data. */
const SOIL_RANGE_STALE_MS = 5 * 60_000;

/**
 * What a soil sensor measured between two dates.
 *
 * The counterpart of `useStationRange`, and `fine` picks the endpoint the same way:
 * off, the hourly roll-ups from `/soil_aggregates/`; on, the raw half-hourly records
 * from `/soilreadings/`, which is what a single day deserves.
 *
 * One thing differs and it matters on the day view. `/soil_aggregates/` withholds
 * rows younger than thirty minutes, so an hourly window always stops a little short
 * of now. The raw endpoint does not, which is a second reason the day view uses it.
 */
export function useSoilRange(
  stationId: string | null,
  depthCm: number,
  offsetSec: number | null,
  range: { from: string; to: string },
  enabled = true,
  fine = false
) {
  const auth = useAgroAuth();

  return useQuery({
    queryKey: soilRangeKey(stationId ?? '', offsetSec ?? 0, range.from, range.to, fine),
    enabled: enabled && auth.status === 'connected' && !!stationId && offsetSec != null,
    staleTime: SOIL_RANGE_STALE_MS,
    queryFn: async ({ signal }): Promise<SoilSample[]> => {
      if (!stationId) return [];
      const fetchRows = fine ? fetchSoilReadings : fetchSoilRange;
      const rows = await withAgroToken(
        auth.getAccessToken,
        (token) => fetchRows(
          token, stationId, offsetSec ?? 0, depthCm, range.from, range.to, { signal }
        ),
        auth.reportUnauthorized
      );
      return rows ?? [];
    },
    retry: (count, error) => !(error instanceof AgroAuthError) && count < 1,
  });
}

export const soilObservationsKey = (stationId: string, offsetSec: number) =>
  ['agroexact', 'soil-observations', stationId, offsetSec] as const;

/**
 * The soil sensor's last twenty-six hours, for the rainfall merge.
 *
 * The blocks on 'Actueel' sum rainfall over windows of past hours, so the sensor's
 * rain has to reach the model per hour — one latest reading cannot answer "how much
 * fell in the last six hours".
 *
 * Fetched for every soil-backed location, not only the PLUS and PRO ones: the merge
 * itself decides whether there is a rain gauge behind the numbers, and asking the
 * question here as well would put that rule in two places.
 */
export function useSoilObservations(
  location: { soilStationId?: string } | null,
  offsetSec: number | null,
  ready = true
) {
  const auth = useAgroAuth();
  const { data: sensors } = useAgroSoilStations();
  const id = location?.soilStationId ?? null;
  const station = useMemo(
    () => (id ? sensors?.find((s) => s.id === id) ?? null : null),
    [sensors, id]
  );

  const query = useQuery({
    queryKey: soilObservationsKey(id ?? '', offsetSec ?? 0),
    enabled: ready && auth.status === 'connected' && !!station && offsetSec != null,
    staleTime: SOIL_READING_STALE_MS,
    queryFn: async ({ signal }): Promise<Record<string, SoilSample>> => {
      if (!station) return {};
      const out = await withAgroToken(
        auth.getAccessToken,
        (token) => fetchSoilHours(
          token, station.id, offsetSec ?? 0, station.depthCm ?? 0, 26, { signal }
        ),
        auth.reportUnauthorized
      );
      return out?.hours ?? {};
    },
    retry: (count, error) => !(error instanceof AgroAuthError) && count < 2,
  });

  return useMemo<SoilObservations | null>(
    () => (station
      ? {
          stationId: station.id,
          stationName: station.name,
          type: station.type,
          hours: query.data ?? {},
        }
      : null),
    [station, query.data]
  );
}

/** One location's soil sensor and what it last reported, for the comparison sheet. */
export interface LocationSoil {
  location: SavedLocation;
  /** Its slot in the saved list — what selecting it from a widget needs. */
  index: number;
  station: SoilStation;
  latest: SoilSample | null;
  loading: boolean;
}

/**
 * Every location that has a soil sensor, with its latest reading.
 *
 * What the comparison sheet needs for a soil block: tap suction on one field and see
 * every field beside it. Only the locations that have a sensor appear — a town has no
 * answer to "how dry is it at 30 cm", and a row of dashes for it would suggest it
 * might have had one.
 *
 * Idle until the sheet is open, like the weather comparison it sits beside: a grid of
 * blocks nobody has tapped should cost nothing.
 */
export function useAllLocationSoil(enabled: boolean): LocationSoil[] {
  const { prefs } = usePrefs();
  const auth = useAgroAuth();
  const { data: sensors } = useAgroSoilStations();

  const fields = useMemo(() => {
    const byId = new Map((sensors ?? []).map((s) => [s.id, s]));
    return prefs.locations
      .map((location, index) => ({
        location, index, station: byId.get(location.soilStationId ?? ''),
      }))
      .filter(
        (r): r is { location: SavedLocation; index: number; station: SoilStation } => !!r.station
      );
  }, [prefs.locations, sensors]);

  const results = useQueries({
    queries: fields.map(({ station }) => ({
      queryKey: soilLatestKey(station.id),
      enabled: enabled && auth.status === 'connected',
      staleTime: SOIL_READING_STALE_MS,
      retry: (count: number, error: Error) =>
        !(error instanceof AgroAuthError) && count < 1,
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<SoilSample | null> => {
        const out = await withAgroToken(
          auth.getAccessToken,
          (token) => fetchLatestSoilMeasurement(
            token, station.id, 0, station.depthCm ?? 0, { signal }
          ),
          auth.reportUnauthorized
        );
        return out?.current ?? null;
      },
    })),
  });

  return fields.map((f, i) => ({
    ...f,
    latest: results[i]?.data ?? null,
    loading: results[i]?.isFetching ?? false,
  }));
}
