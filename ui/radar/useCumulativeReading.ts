/**
 * The rainfall total at the location the map is about.
 *
 * Two different things can answer that question, and they are not interchangeable:
 *
 *  - A **station-backed location** has a rain gauge standing in it. Its own hourly
 *    totals are the measurement; the radar field is a calibrated estimate *of* that
 *    measurement. Where the gauge has spoken, it wins.
 *  - **Everywhere else** the layer's own raster is the only answer there is, sampled
 *    at the location's cell.
 *
 * So the read-out says which of the two it is showing. A number whose provenance is
 * not on screen invites the reader to compare it with the one they saw yesterday,
 * which may have come from the other source.
 *
 * The station sum is taken over exactly the window the layer draws — `(anchor - hours,
 * anchor]`, in UTC — rather than over the last N hours from now. The anchor can be
 * over an hour old, and summing to "now" would put a different stretch of weather
 * beside the picture. `sumPrecipWindow` holds that rule.
 *
 * A station with gaps falls back to the raster rather than reporting a total it
 * cannot stand behind, and says so.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AgroAuthError, fetchStationPrecipHours, sumPrecipWindow, withAgroToken,
  type PrecipHour,
} from '../../core/sources/agroexact';
import { sampleMm, type CumulativeManifest, type CumulativeWindow } from '../../core/radar/cumulative';
import { useAgroAuth } from '../../state/auth';
import type { SavedLocation } from '../../core/prefs';

/** Hourly aggregates are five minutes fresh at best, so anything newer is reused. */
const PRECIP_STALE_MS = 5 * 60_000;

/** The longest window is 48 hours; two hours of slack covers the anchor being behind
 *  the wall clock without asking for a third day of rows. */
const PRECIP_HOURS = 50;

export const precipHoursKey = (stationId: string) =>
  ['agroexact', 'precip-hours', stationId] as const;

export type ReadingOrigin = 'station' | 'radar';

export interface CumulativeReading {
  /** Millimetres over the window, or null where neither source can answer. */
  mm: number | null;
  origin: ReadingOrigin | null;
  /** Named where the answer came from a gauge, so the panel can say which one. */
  stationName?: string;
  /** Set when a station was available but could not cover the window on its own. */
  stationGap?: { hoursFound: number; hoursExpected: number };
  /** The location lies outside the layer's crop, which is tighter than the map. */
  outsideCrop: boolean;
  loading: boolean;
}

/**
 * The total at one location, from the gauge if there is one and the raster otherwise.
 *
 * `values` is the active window's raster; while it is still arriving the radar answer
 * is simply not available yet, which is a `loading` rather than a null.
 */
export function useCumulativeReading(
  location: SavedLocation,
  manifest: CumulativeManifest | null,
  window: CumulativeWindow | undefined,
  values: Uint16Array | null
): CumulativeReading {
  const auth = useAgroAuth();
  const stationId = location.stationId;
  const enabled = auth.status === 'connected' && !!stationId && !!window;

  const station = useQuery({
    queryKey: precipHoursKey(stationId ?? ''),
    enabled,
    staleTime: PRECIP_STALE_MS,
    queryFn: async ({ signal }): Promise<PrecipHour[]> => {
      const rows = await withAgroToken(
        auth.getAccessToken,
        (token) => fetchStationPrecipHours(token, stationId as string, PRECIP_HOURS, { signal }),
        auth.reportUnauthorized
      );
      return rows ?? [];
    },
    // A signed-out account is not a failure worth retrying against.
    retry: (count, error) => !(error instanceof AgroAuthError) && count < 2,
  });

  return useMemo<CumulativeReading>(() => {
    if (!manifest || !window) {
      return { mm: null, origin: null, outsideCrop: false, loading: true };
    }

    const cell = sampleMm(manifest, values ?? new Uint16Array(0), location.lat, location.lon);
    // Null from a raster that is present means the point is off the crop; null from
    // one that has not arrived means the numbers are still coming.
    const outsideCrop = values != null && cell == null;
    const radarMm = values != null ? cell : null;

    if (enabled && station.data?.length) {
      const anchorMs = new Date(window.end).getTime();
      const sum = sumPrecipWindow(station.data, anchorMs, window.hours);
      if (sum.hoursFound >= sum.hoursExpected) {
        return {
          mm: sum.mm,
          origin: 'station',
          stationName: location.stationName,
          outsideCrop,
          loading: false,
        };
      }
      // The gauge is short of the window it was asked for. Its partial total would
      // read low against the picture, so the raster answers and the gap is named.
      return {
        mm: radarMm,
        origin: radarMm != null ? 'radar' : null,
        stationName: location.stationName,
        stationGap: { hoursFound: sum.hoursFound, hoursExpected: sum.hoursExpected },
        outsideCrop,
        loading: values == null,
      };
    }

    return {
      mm: radarMm,
      origin: radarMm != null ? 'radar' : null,
      outsideCrop,
      loading: values == null || (enabled && station.isLoading),
    };
  }, [manifest, window, values, location, enabled, station.data, station.isLoading]);
}
