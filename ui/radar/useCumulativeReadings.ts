/**
 * Rainfall totals for every saved location, and the accumulation curve for one.
 *
 * The map prints a total per location and the panel draws one location's curve across
 * every window. Both want the same precedence — a rain gauge standing in a location
 * speaks for it, the raster answers everywhere else — so the precedence itself lives
 * in `core/radar/reading` as a pure function and this hook only feeds it.
 *
 * What it feeds it is the station side. One query per station on the account, shared
 * through TanStack Query's cache, so two locations on the same station cost one call
 * and a slider drag costs none: the rows cover the longest window, and every window
 * is a sum over a slice of them.
 *
 * Nothing is asked for while the account is signed out, or for a location with no
 * station. Those read straight off the raster, which is already on the device.
 */
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  AgroAuthError, fetchStationPrecipHours, withAgroToken, type PrecipHour,
} from '../../core/sources/agroexact';
import { readingFor, seriesFor, type CumulativeReading, type SeriesPoint } from '../../core/radar/reading';
import type { CumulativeManifest, CumulativeWindow } from '../../core/radar/cumulative';
import { useAgroAuth } from '../../state/auth';
import type { SavedLocation } from '../../core/prefs';

/** Hourly aggregates are five minutes fresh at best, so anything newer is reused. */
const PRECIP_STALE_MS = 5 * 60_000;

/** The longest window is 48 hours; two hours of slack covers the anchor being behind
 *  the wall clock without asking for a third day of rows. */
const PRECIP_HOURS = 50;

export const precipHoursKey = (stationId: string) =>
  ['agroexact', 'precip-hours', stationId] as const;

export interface CumulativeReadings {
  /** One per location, in the order they were given. */
  readings: CumulativeReading[];
  /** The accumulation curve for `selected`, shortest window first. */
  series: SeriesPoint[];
}

/**
 * Totals for every location, and the curve for the selected one.
 *
 * `locations` is the reader's saved list in its own order, which is also the order the
 * map resolves overlapping bubbles in.
 */
export function useCumulativeReadings(
  locations: readonly SavedLocation[],
  selected: SavedLocation,
  manifest: CumulativeManifest | null,
  windows: readonly CumulativeWindow[],
  window: CumulativeWindow | undefined,
  rasters: ReadonlyMap<number, Uint16Array>
): CumulativeReadings {
  const auth = useAgroAuth();
  const connected = auth.status === 'connected';

  // One entry per station behind any of these locations, the selected one included.
  const stationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of [...locations, selected]) if (l.stationId) ids.add(l.stationId);
    return [...ids];
  }, [locations, selected]);

  const queries = useQueries({
    queries: stationIds.map((stationId) => ({
      queryKey: precipHoursKey(stationId),
      enabled: connected,
      staleTime: PRECIP_STALE_MS,
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<PrecipHour[]> => {
        const rows = await withAgroToken(
          auth.getAccessToken,
          (token) => fetchStationPrecipHours(token, stationId, PRECIP_HOURS, { signal }),
          auth.reportUnauthorized
        );
        return rows ?? [];
      },
      // A signed-out account is not a failure worth retrying against.
      retry: (count: number, error: Error) =>
        !(error instanceof AgroAuthError) && count < 2,
    })),
  });

  // `useQueries` hands back a new array every render, so the map is rebuilt only when
  // a query has actually answered — otherwise every render below it recomputes too.
  const answeredAt = queries.map((q) => q.dataUpdatedAt).join(',');
  const rowsByStation = useMemo(() => {
    const map = new Map<string, PrecipHour[]>();
    stationIds.forEach((id, i) => {
      const rows = queries[i]?.data;
      if (rows?.length) map.set(id, rows);
    });
    return map;
    // `queries` is deliberately not a dependency; `answeredAt` stands for its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationIds, answeredAt]);

  const pending = queries.some((q) => q.isLoading);

  const values = window ? rasters.get(window.hours) ?? null : null;

  const readings = useMemo(
    () =>
      locations.map((location) =>
        readingFor({
          location,
          manifest,
          window,
          values,
          stationRows: location.stationId ? rowsByStation.get(location.stationId) : undefined,
          stationPending: !!location.stationId && pending,
        })
      ),
    [locations, manifest, window, values, rowsByStation, pending]
  );

  const series = useMemo(
    () =>
      seriesFor({
        location: selected,
        manifest,
        windows,
        rasters,
        stationRows: selected.stationId ? rowsByStation.get(selected.stationId) : undefined,
      }),
    [selected, manifest, windows, rasters, rowsByStation]
  );

  return { readings, series };
}
