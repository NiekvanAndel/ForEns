/**
 * The account's stations, and what they measured.
 *
 * Three concerns, deliberately in one file because they are one story: which
 * stations exist, which locations they should produce, and what the station behind
 * the page in front is reporting right now.
 *
 * Everything here goes through TanStack Query rather than hand-rolled effects. The
 * station list is asked for by four screens (Instellingen, Radar, the sync, the
 * observations lookup) and without a shared cache each mount would refetch it; with
 * one, the second caller gets the first caller's answer and a swipe between
 * locations costs nothing.
 *
 * ## Why the sync is separate from the fetch
 *
 * Turning stations into locations means a reverse lookup per station — the location
 * carries the *town*, not the station name — and writing to preferences. Neither
 * belongs in a query function: one is a second network hop that must not fail the
 * first, and the other is a side effect that would run again on every cache read.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AgroAuthError, fetchStationObservations, fetchStations, withAgroToken,
  type AgroStation, type StationObservations,
} from '../core/sources/agroexact';
import { stationForLocation } from '../core/model/station';
import { NOMINATIM_MIN_INTERVAL_MS, reverseGeocode } from '../core/sources/geocoding';
import { agroIntegration, syncStationLocations, type SavedLocation, type StationPlace } from '../core/prefs';
import { usePrefs } from './prefs';
import { useAgroAuth } from './auth';

/** The station network changes rarely; an hour between refetches is generous. */
const STATIONS_STALE_MS = 60 * 60_000;
/** Measurements arrive every ten minutes, so anything fresher than five is reused. */
const OBSERVATIONS_STALE_MS = 5 * 60_000;

export const stationsKey = ['agroexact', 'stations'] as const;
export const observationsKey = (stationId: string, offsetSec: number) =>
  ['agroexact', 'observations', stationId, offsetSec] as const;

/**
 * The weather stations linked to the signed-in account.
 *
 * Returns an empty list, not an error, when nobody is signed in: every caller has a
 * perfectly good page to draw without stations.
 */
export function useAgroStations() {
  const auth = useAgroAuth();
  const enabled = auth.status === 'connected';

  return useQuery({
    queryKey: stationsKey,
    enabled,
    staleTime: STATIONS_STALE_MS,
    queryFn: async ({ signal }): Promise<AgroStation[]> => {
      const rows = await withAgroToken(auth.getAccessToken, (token) =>
        fetchStations(token, { signal })
      );
      return rows ?? [];
    },
    // A signed-out account is not a failure worth retrying against.
    retry: (count, error) => !(error instanceof AgroAuthError) && count < 2,
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Keep the saved locations in step with the account's stations.
 *
 * Runs when the station list changes — on sign-in, on a manual refresh, and after an
 * hour of use. A failed fetch never reaches here, so a station can only disappear
 * from the list because the account no longer has it.
 *
 * Nominatim allows one request per second and asks that clients mean it, so the
 * lookups run in sequence with that gap and only for stations that do not already
 * have a location: an account with a hundred stations pays a hundred lookups once,
 * spread over a hundred seconds in the background, and nothing thereafter. Locations
 * appear as the sync finishes rather than one by one, which is the trade for not
 * hammering a free service on someone else's behalf.
 */
export function useStationLocationSync() {
  const { prefs, mutate } = usePrefs();
  const { data: stations } = useAgroStations();
  const { status } = useAgroAuth();
  /** Station ids already reconciled this session, so a re-render cannot re-run the
   *  lookups for them. */
  const done = useRef<string>('');

  useEffect(() => {
    if (status !== 'connected' || !stations) return;
    const fingerprint = stations.map((s) => s.id).sort().join(',');
    if (done.current === fingerprint) return;
    done.current = fingerprint;

    let alive = true;
    (async () => {
      const known = new Map(
        prefs.locations
          .filter((l) => l.source === 'agroexact' && l.stationId)
          .map((l) => [l.stationId as string, l])
      );

      const places: StationPlace[] = [];
      for (const s of stations) {
        const existing = known.get(s.id);
        // A location that already stands for this station keeps its town name: the
        // reverse lookup is the expensive half, and the town has not moved.
        if (existing && Math.abs(existing.lat - s.lat) < 1e-4 && Math.abs(existing.lon - s.lon) < 1e-4) {
          places.push({
            stationId: s.id, stationName: s.name, lat: s.lat, lon: s.lon,
            place: existing.name, sub: existing.sub,
          });
          continue;
        }
        if (places.length) await sleep(NOMINATIM_MIN_INTERVAL_MS);
        if (!alive) return;
        const place = await reverseGeocode(s.lat, s.lon, prefs.lang);
        if (!alive) return;
        places.push({
          stationId: s.id,
          stationName: s.name,
          lat: s.lat,
          lon: s.lon,
          // `reverseGeocode` falls back to the coordinates, so the station always
          // becomes *some* location rather than being dropped for want of a name.
          place: place.name,
          sub: place.sub,
        });
      }

      if (!alive) return;
      mutate((p) => {
        const synced = syncStationLocations(p, places);
        return {
          ...synced,
          integrations: {
            ...synced.integrations,
            agroexact: { ...agroIntegration(synced), connected: true, lastSyncMs: Date.now() },
          },
        };
      });
    })().catch(() => {
      // A failed sync leaves the locations exactly as they were, and lets the next
      // station-list change try again.
      done.current = '';
    });

    return () => { alive = false; };
    // `prefs.locations` is read, not depended on: reacting to it would restart the
    // sync with every write the sync itself makes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, status, mutate, prefs.lang]);
}

/** Refetch the station list now, for the manual refresh in Instellingen. */
export function useRefreshStations() {
  const client = useQueryClient();
  return useCallback(
    () => client.invalidateQueries({ queryKey: stationsKey }),
    [client]
  );
}


/**
 * What the station behind this location is measuring.
 *
 * `offsetSec` comes from the forecast, because the measured hours have to land on
 * the same local hours the model built; until it is known the query stays idle
 * rather than bucketing an hour out.
 *
 * A station that answers with nothing at all has stopped reporting, and the account
 * is the place to find out whether it still exists — so that invalidates the station
 * list, which is what removes a decommissioned station's location.
 */
export function useStationObservations(
  location: SavedLocation,
  offsetSec: number | null,
  ready: boolean
) {
  const { prefs } = usePrefs();
  const auth = useAgroAuth();
  const { data: stations } = useAgroStations();
  const client = useQueryClient();
  const integration = agroIntegration(prefs);

  const station = useMemo(
    () => stationForLocation(location, stations, integration.useForCurrentLocation),
    [location, stations, integration.useForCurrentLocation]
  );

  const query = useQuery({
    queryKey: observationsKey(station?.id ?? '', offsetSec ?? 0),
    enabled: ready && auth.status === 'connected' && !!station && offsetSec != null,
    staleTime: OBSERVATIONS_STALE_MS,
    queryFn: async ({ signal }): Promise<StationObservations | null> => {
      if (!station) return null;
      const obs = await withAgroToken(auth.getAccessToken, (token) =>
        fetchStationObservations(token, station.id, offsetSec ?? 0, { signal })
      );
      return obs ? { ...obs, stationName: obs.stationName ?? station.name } : null;
    },
    retry: (count, error) => !(error instanceof AgroAuthError) && count < 1,
  });

  const empty =
    query.isSuccess && query.data != null && !query.data.current && !Object.keys(query.data.hours).length;

  useEffect(() => {
    if (empty) client.invalidateQueries({ queryKey: stationsKey });
  }, [empty, client]);

  return query;
}
