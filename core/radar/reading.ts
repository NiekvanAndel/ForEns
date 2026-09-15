/**
 * What a location's rainfall total is, and where the figure came from.
 *
 * Two different things can answer that question, and they are not interchangeable:
 *
 *  - A **station-backed location** has a rain gauge standing in it. Its own hourly
 *    totals are the measurement; the radar field is a calibrated estimate *of* that
 *    measurement. Where the gauge has spoken for the whole window, it wins.
 *  - **Everywhere else** the layer's own raster is the only answer there is, sampled
 *    at the location's cell.
 *
 * So every figure carries its origin. A number whose provenance is not on screen
 * invites the reader to compare it with the one beside it, which may have come from
 * the other source.
 *
 * The station sum is taken over exactly the window the layer draws — `(anchor -
 * hours, anchor]`, in UTC — rather than over the last N hours from now. The anchor
 * can be over an hour old, and summing to "now" would put a different stretch of
 * weather beside the picture. `sumPrecipWindow` holds that rule.
 *
 * Pure, and therefore here rather than in the hook that fetches for it: the map draws
 * one of these per saved location and the panel draws a series of them for one
 * location, and neither wants its own copy of the precedence.
 */
import { sampleMm, type CumulativeManifest, type CumulativeWindow } from './cumulative';
import { sumPrecipWindow, type PrecipHour } from '../sources/agroexact';

export type ReadingOrigin = 'station' | 'radar';

/** Everything a read-out needs about one location, whatever provides it. */
export interface ReadingLocation {
  lat: number;
  lon: number;
  stationId?: string;
  stationName?: string;
}

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

export interface ReadingInput {
  location: ReadingLocation;
  manifest: CumulativeManifest | null;
  window: CumulativeWindow | undefined;
  /** The window's raster, or null while it is still arriving. */
  values: Uint16Array | null;
  /** The station's hourly rainfall, where this location has a station and it has
   *  answered. Undefined for a location without one, or before it answers. */
  stationRows?: readonly PrecipHour[];
  /** A station call is still in flight, so "no figure" is not yet the answer. */
  stationPending?: boolean;
}

const EMPTY = new Uint16Array(0);

export function readingFor({
  location, manifest, window, values, stationRows, stationPending = false,
}: ReadingInput): CumulativeReading {
  if (!manifest || !window) {
    return { mm: null, origin: null, outsideCrop: false, loading: true };
  }

  const cell = sampleMm(manifest, values ?? EMPTY, location.lat, location.lon);
  // Null from a raster that is present means the point is off the crop; null from one
  // that has not arrived means the numbers are still coming.
  const outsideCrop = values != null && cell == null;
  const radarMm = values != null ? cell : null;

  if (location.stationId && stationRows?.length) {
    const anchorMs = new Date(window.end).getTime();
    const sum = sumPrecipWindow(stationRows, anchorMs, window.hours);
    if (sum.hoursFound >= sum.hoursExpected) {
      return {
        mm: sum.mm,
        origin: 'station',
        stationName: location.stationName,
        outsideCrop,
        loading: false,
      };
    }
    // The gauge is short of the window it was asked for. Its partial total would read
    // low against the picture, so the raster answers and the gap is named.
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
    loading: values == null || stationPending,
  };
}

/** One point of the accumulation curve: a window, and what it had collected by then. */
export interface SeriesPoint {
  hours: number;
  /** Millimetres, or null while that window's raster has not arrived. */
  mm: number | null;
  origin: ReadingOrigin | null;
}

export interface SeriesInput {
  location: ReadingLocation;
  manifest: CumulativeManifest | null;
  /** In the order the chart's axis runs — shortest first. */
  windows: readonly CumulativeWindow[];
  /** Rasters decoded so far, by window length. */
  rasters: ReadonlyMap<number, Uint16Array>;
  stationRows?: readonly PrecipHour[];
}

/**
 * The accumulation curve for one location: the total at each published window.
 *
 * The windows nest — the 24 hour field is the newest 24 hours of the 48 hour one — so
 * read shortest-first these totals are a running sum, and the line can only climb.
 * Where a window's raster has not arrived the point is null rather than zero: a gap
 * in the curve is honest, a floor is a claim that it stopped raining.
 */
export function seriesFor({
  location, manifest, windows, rasters, stationRows,
}: SeriesInput): SeriesPoint[] {
  if (!manifest) return [];

  return windows.map((window) => {
    const reading = readingFor({
      location,
      manifest,
      window,
      values: rasters.get(window.hours) ?? null,
      stationRows,
    });
    return { hours: window.hours, mm: reading.mm, origin: reading.origin };
  });
}
