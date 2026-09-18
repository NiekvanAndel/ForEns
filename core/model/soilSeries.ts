/**
 * Soil quantities on 'Grafiek'.
 *
 * Separate from `buildSeries` rather than folded into it, because the two are not the
 * same problem wearing different field names. A weather series merges a station's
 * measurements with a model, per quantity and per hour, and carries a forecast past
 * now. A soil series has no model behind it: `/soil_aggregates/` is all there is, and
 * the suction forecast exists in the web app but not in API v2. Bending the weather
 * builder around that would mean a merge with nothing to merge and a `future` half
 * that is always empty.
 *
 * What is shared is the shape. These produce the app's own `Sample`, so `SeriesChart`
 * draws them with the same axes, the same cursor and the same dashed-after-now rule
 * as everything else — and the threshold lines from the indicator layer sit on top
 * without the chart learning anything new.
 */
import { DAY_RESOLUTION_FROM, daySpan, timeKeys, type Sample, type Series, type SeriesShape } from './series';
import { soilCapabilities, type SoilThresholds } from './soil';
import type { SoilSample } from '../sources/agroexact';

/** Which soil quantity a chart is about. */
export type SoilSeriesKey =
  | 'waterTension' | 'pF' | 'waterPercent' | 'refillMm' | 'soilTemp'
  | 'temp10' | 'humidity10';

export interface SoilSeriesMeta {
  key: SoilSeriesKey;
  shape: SeriesShape;
  axisMin?: number;
  axisMax?: number;
  axisFixed?: boolean;
  /** True where the quantity only exists on a sensor with a canopy probe. */
  canopy?: boolean;
}

export const SOIL_SERIES_META: Record<SoilSeriesKey, SoilSeriesMeta> = {
  // Suction has no axis of its own: the field's thresholds set it, and the page pins
  // it from zero to a little past critical. See `soilTensionAxis`.
  waterTension: { key: 'waterTension', shape: 'line', axisMin: 0 },
  /**
   * pF gets a fixed axis, and it is the one place here where that is not fussiness.
   *
   * It is a logarithm, so its whole meaningful range is 0 to 4,2 — and on an axis that
   * scales to the data, a week in which the field stayed wet becomes one straight line
   * across the middle of the plot. Logarithmic and self-scaling together throw away
   * the only thing the reader came to see.
   */
  pF: { key: 'pF', shape: 'line', axisMin: 0, axisMax: 4.2, axisFixed: true },
  waterPercent: { key: 'waterPercent', shape: 'line', axisMin: 0, axisMax: 100 },
  refillMm: { key: 'refillMm', shape: 'line', axisMin: 0 },
  soilTemp: { key: 'soilTemp', shape: 'line' },
  temp10: { key: 'temp10', shape: 'line', canopy: true },
  humidity10: { key: 'humidity10', shape: 'line', axisMin: 0, axisMax: 100, canopy: true },
};

/** What one soil measurement reads for a quantity. */
function valueOf(key: SoilSeriesKey, s: SoilSample): number | null {
  switch (key) {
    case 'waterTension': return s.tension;
    case 'pF': return s.pF;
    case 'waterPercent': return s.waterPercent;
    case 'refillMm': return s.refillMm;
    case 'soilTemp': return s.soilTemp;
    case 'temp10': return s.temp10;
    case 'humidity10': return s.humidity10;
  }
}

/**
 * Which soil quantities this sensor can draw.
 *
 * Two filters, and they answer different questions. The sensor's **model** says which
 * probes exist — BASIC suction only, PLUS with rainfall, PRO with the air at 10 cm —
 * and that is hardware, so a BASIC never offers a canopy pill however the window went.
 * The **readings** then say whether anything came back, because a pill onto an empty
 * chart leaves the reader wondering what they did wrong.
 *
 * Keeping them apart is what lets the app tell a probe that is not there from a probe
 * that is silent. Deriving it from the readings alone, as this did first, collapses
 * the two into one shrug.
 */
export function soilSeriesKeys(
  versionType: string | null | undefined,
  samples: readonly SoilSample[]
): SoilSeriesKey[] {
  const can = soilCapabilities(versionType);
  return (Object.keys(SOIL_SERIES_META) as SoilSeriesKey[])
    .filter((key) => (SOIL_SERIES_META[key].canopy ? can.canopy : true))
    .filter((key) => samples.some((s) => valueOf(key, s) != null));
}

export interface BuildSoilSeriesInput {
  key: SoilSeriesKey;
  /** The window, as local calendar days. */
  from: string;
  to: string;
  /** Oldest first, as the source layer returns them. */
  samples: readonly SoilSample[];
  /** Sixty for the hourly aggregates, thirty for a single day's raw readings. */
  stepMinutes?: number;
}

/**
 * Build the samples for one soil quantity over one window.
 *
 * Every sample is a measurement, so `measured` is true wherever there is a value and
 * `future` is false throughout: nothing here claims anything about a moment that has
 * not happened. The day a suction forecast reaches API v2, it joins as future samples
 * and the chart starts dashing them without a line of this changing.
 *
 * A grid slot the sensor did not report is a null rather than a carried-forward
 * value. A soil sensor reports every half hour and the gaps are real — a gap the
 * chart bridges silently is a chart that says the field was measured when it was not.
 */
export function buildSoilSeries({
  key, from, to, samples, stepMinutes = 60,
}: BuildSoilSeriesInput): Series {
  const byTime = new Map(samples.map((s) => [s.time, s]));

  const grid: Sample[] = timeKeys(from, to, stepMinutes).map((time) => {
    const s = byTime.get(time);
    const value = s ? valueOf(key, s) : null;
    return {
      key: time,
      value,
      measured: value != null,
      future: false,
      source: value != null ? ('station' as const) : null,
    };
  });

  const span = daySpan(
    grid[0]?.key.slice(0, 10) ?? from,
    grid[grid.length - 1]?.key.slice(0, 10) ?? to
  );
  const byDay = span > DAY_RESOLUTION_FROM;
  const out = byDay ? bucketSoilByDay(grid) : grid;

  return {
    resolution: byDay ? 'day' : stepMinutes < 60 ? 'minute' : 'hour',
    samples: out,
    stats: summarise(out),
    anyMeasured: out.some((s) => s.measured),
    // Nothing here is a forecast, so the chart never splits its line.
    forecastFrom: -1,
  };
}

/**
 * One sample per calendar day: the day's mean, with its range as a band.
 *
 * Every soil quantity is a level rather than a total — nothing here accumulates the
 * way rainfall does — so they all average. The band is worth keeping for the same
 * reason it is on temperature: a field that ran from 20 to 55 kPa and a field that
 * sat at 37 are the same line and very different days.
 */
function bucketSoilByDay(samples: readonly Sample[]): Sample[] {
  const days = new Map<string, number[]>();
  for (const s of samples) {
    if (s.value == null) continue;
    const day = s.key.slice(0, 10);
    const list = days.get(day);
    if (list) list.push(s.value);
    else days.set(day, [s.value]);
  }

  return [...new Set(samples.map((s) => s.key.slice(0, 10)))].map((day) => {
    const values = days.get(day) ?? [];
    if (!values.length) {
      return { key: day, value: null, measured: false, future: false, source: null };
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      key: day,
      value: Math.round(mean * 10) / 10,
      band: { lo: Math.min(...values), hi: Math.max(...values) },
      measured: true,
      future: false,
      source: 'station' as const,
    };
  });
}

/** The window's own figures, in the shape the page's summary line already reads. */
function summarise(samples: readonly Sample[]): Series['stats'] {
  const values = samples.map((s) => s.value).filter((v): v is number => v != null);
  if (!values.length) return null;
  const total = values.reduce((a, b) => a + b, 0);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Math.round((total / values.length) * 10) / 10,
    total: Math.round(total * 10) / 10,
    secondaryMax: null,
  };
}

/** How far past the critical threshold a suction chart reaches. */
const CRITICAL_HEADROOM = 1.15;

/**
 * The axis a suction chart is pinned to: zero to a little past critical.
 *
 * Always the whole ladder, never fitted to the window. Two reasons, and the second is
 * the one that matters.
 *
 * A fitted axis makes a wet week and a dry week the same picture — the line wanders
 * across the middle of the plot either way, and only the numbers down the side say
 * which is which. Pinned, the line's *height* is the reading, so a glance at the shape
 * of the week is a glance at how the field is doing.
 *
 * And a fitted axis hides the boundaries that are not near the data, which is exactly
 * backwards: a field sitting comfortably at 20 kPa when critical is 87 is a field
 * whose owner wants to see all that room underneath it.
 *
 * Zero at the bottom because suction has a floor and it means something — saturated
 * soil — unlike a temperature's. A little past critical at the top so the red band has
 * height to be seen rather than being a line along the ceiling; and never below the
 * data, because a reading above critical must still be on the chart.
 */
export function soilTensionAxis(
  thresholds: SoilThresholds | null,
  samples: readonly { value: number | null }[] = []
): { axisMin: number; axisMax: number; axisFixed: true } | null {
  if (!thresholds) return null;
  const peak = samples.reduce(
    (hi, s) => (s.value != null && s.value > hi ? s.value : hi),
    0
  );
  return {
    axisMin: 0,
    axisMax: Math.max(thresholds.critical * CRITICAL_HEADROOM, peak),
    axisFixed: true,
  };
}
