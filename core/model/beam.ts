/**
 * The ensemble beam behind a day row.
 *
 * Every per-measurand tab in the web app draws the same figure, and it is the whole
 * reason for carrying 51 members: a shaded band showing where the members fall, a
 * hairline at their median, and a marker at the value actually being reported. When
 * the marker sits outside the band you can see at a glance that the deterministic
 * run is an outlier — which is exactly when `resolveDayValues` swaps in the median
 * and prints `~`.
 *
 * The port had this as a single "band plus whisker", which lost the median and lost
 * the distinction between the reported value and the members' spread. This restores
 * the web app's figure per tab, including its scales:
 *
 *   precipitation  0 … max(10, widest p90)
 *   temperature    coldest p10 − 2 … warmest p90 + 2, minima and maxima on one axis
 *   wind           max(0, lowest p10 − 5) … highest p90 + 5
 *   humidity       max(0, lowest p10 − 5) … min(100, highest p90 + 5)
 *   sunshine       0 … the day's own daylight hours, so "8 h" in December and in
 *                  June are not the same bar
 *
 * Geometry comes out as fractions of the scale, so the component only places things;
 * it does no arithmetic and can be restyled without touching any of this.
 */
import type { Day } from './types';
import type { LayerKey } from './layers';
import { resolveDayValues } from './dayValues';

export type BeamTone = 'low' | 'high' | 'neutral' | 'precip' | 'sun' | 'et0';

export interface BeamRange {
  from: number;
  to: number;
  tone: BeamTone;
}
export interface BeamMark {
  at: number;
  tone: BeamTone;
}

export interface Beam {
  /** Shaded spans showing where the members fall. */
  ranges: BeamRange[];
  /** Hairlines at the members' medians. */
  medians: BeamMark[];
  /** The reported value or values. */
  markers: BeamMark[];
}

export interface Scale {
  lo: number;
  hi: number;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const nums = (days: readonly Day[], pick: (d: Day) => unknown): number[] =>
  days.map(pick).map(num).filter((v): v is number => v != null);

/**
 * Daylight hours for a date and latitude — the sunshine bar's full scale.
 *
 * Ported from `_daylightHours`: the standard declination approximation, with the
 * polar cases returning a whole day or none rather than `NaN` out of `acos`.
 */
export function daylightHours(dateStr: string, lat: number): number {
  const d = new Date(dateStr + 'T12:00:00Z');
  const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 0);
  const doy = Math.floor((d.getTime() - startOfYear) / 86_400_000);
  const phi = (lat * Math.PI) / 180;
  const delta = 0.409 * Math.sin(((2 * Math.PI) / 365) * doy - 1.39);
  const cosH0 = -Math.tan(phi) * Math.tan(delta);
  if (cosH0 <= -1) return 24;
  if (cosH0 >= 1) return 0;
  return (2 * Math.acos(cosH0) * 12) / Math.PI;
}

/**
 * The scale a layer's beams are drawn against, shared by every day shown so the
 * column can be read downward.
 */
export function beamScale(days: readonly Day[], layer: LayerKey, lat = 52): Scale {
  switch (layer) {
    case 'precip': {
      // Floored at 10 mm so an entirely dry week does not magnify a trace of drizzle.
      const hi = Math.max(10, ...nums(days, (d) => d.precipP90));
      return { lo: 0, hi };
    }
    case 'temp': {
      const lows = nums(days, (d) => d.tempMinP10);
      const highs = nums(days, (d) => d.tempMaxP90);
      if (!lows.length || !highs.length) return { lo: 0, hi: 1 };
      return { lo: Math.min(...lows) - 2, hi: Math.max(...highs) + 2 };
    }
    case 'wind': {
      const lows = nums(days, (d) => d.windP10);
      const highs = nums(days, (d) => d.windP90);
      if (!lows.length || !highs.length) return { lo: 0, hi: 1 };
      return { lo: Math.max(0, Math.min(...lows) - 5), hi: Math.max(...highs) + 5 };
    }
    case 'humidity': {
      const lows = nums(days, (d) => d.humidityP10);
      const highs = nums(days, (d) => d.humidityP90);
      return {
        lo: Math.max(0, (lows.length ? Math.min(...lows) : 0) - 5),
        hi: Math.min(100, (highs.length ? Math.max(...highs) : 100) + 5),
      };
    }
    case 'sun': {
      // Each day is drawn against its own daylight, so the longest one sets the axis.
      const hi = Math.max(1, ...days.map((d) => daylightHours(d.date, lat)));
      return { lo: 0, hi };
    }
    case 'overview':
      return { lo: 0, hi: 1 };
  }
}

/** Largest evaporation across the days shown, for the sun row's second bar. */
export function et0Scale(days: readonly Day[]): number {
  return Math.max(4, ...nums(days, (d) => d.et0)) + 1;
}

/** Clamp a value onto a scale as a fraction, 0 to 1. */
export function place(value: number | null | undefined, scale: Scale): number | null {
  const v = num(value);
  if (v == null) return null;
  const span = scale.hi - scale.lo || 1;
  return Math.max(0, Math.min(1, (v - scale.lo) / span));
}

const span = (from: number | null, to: number | null, tone: BeamTone): BeamRange[] =>
  from != null && to != null ? [{ from, to: Math.max(to, from + 0.004), tone }] : [];

const mark = (at: number | null, tone: BeamTone): BeamMark[] =>
  at != null ? [{ at, tone }] : [];

/**
 * Build the beam for one day on one layer.
 *
 * Only drawn once the ensemble has loaded: before that there are no percentiles,
 * and `processAll` rounds the missing ones through `Math.round(null)`, which is 0 —
 * so drawing anyway would show every day as a hard zero rather than as not yet known.
 */
export function layerBeam(day: Day, layer: LayerKey, dayIndex: number, scale: Scale): Beam {
  const v = resolveDayValues(day, { dayIndex });
  const ens = day.ensLoaded ?? false;
  const p = (value: unknown) => (ens ? place(num(value), scale) : null);

  switch (layer) {
    case 'precip':
      return {
        ranges: span(p(day.precipP10), p(day.precipP90), 'precip'),
        medians: mark(p(day.precipMedian), 'precip'),
        markers: mark(place(v.precip.value, scale), 'precip'),
      };

    // Minima and maxima share one axis, so the day reads as a range rather than as
    // two unrelated numbers — the web app's temperature row does the same.
    case 'temp':
      return {
        ranges: [
          ...span(p(day.tempMinP10), p(day.tempMinP90), 'low'),
          ...span(p(day.tempMaxP10), p(day.tempMaxP90), 'high'),
        ],
        medians: [
          ...mark(p(day.tempMinP50), 'low'),
          ...mark(p(day.tempMaxP50), 'high'),
        ],
        markers: [
          ...mark(place(v.tempMin.value, scale), 'low'),
          ...mark(place(v.tempMax.value, scale), 'high'),
        ],
      };

    case 'wind':
      return {
        ranges: span(p(day.windP10), p(day.windP90), 'neutral'),
        medians: mark(p(day.windP50), 'neutral'),
        markers: mark(place(v.wind.value, scale), 'neutral'),
      };

    // Split at the median: the dry half of the spread reads warm, the humid half
    // cool, with the reported minimum and maximum marked on each.
    case 'humidity':
      return {
        ranges: [
          ...span(p(day.humidityP10), p(day.humidityMedian), 'high'),
          ...span(p(day.humidityMedian), p(day.humidityP90), 'low'),
        ],
        medians: mark(p(day.humidityMedian), 'neutral'),
        markers: [
          ...mark(place(v.humidityMin.value, scale), 'high'),
          ...mark(place(v.humidityMax.value, scale), 'low'),
        ],
      };

    // Sunshine is deterministic — there is no ensemble behind it, so no band.
    case 'sun':
      return {
        ranges: span(0, place(v.sunHours, scale), 'sun'),
        medians: [],
        markers: [],
      };

    case 'overview':
      return { ranges: [], medians: [], markers: [] };
  }
}
