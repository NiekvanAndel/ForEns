/**
 * The series behind 'Grafiek'.
 *
 * One window, one quantity, one list of samples — assembled from whatever can speak
 * for each hour in it. Where an AgroExact station covers the location its
 * measurements are used; where they run out, the weather model fills in; and past
 * the current hour the model's forecast carries the line on to the end of the
 * chosen period.
 *
 * Every sample records *which* of those it came from, because the chart draws them
 * differently and has to: a measured Tuesday and a forecast Thursday on one
 * unbroken line is a chart that lies about what is known. Measured is solid,
 * forecast is dashed, and the two never merge.
 *
 * ## Hours or days
 *
 * A month at hourly resolution is seven hundred marks across a phone — unreadable,
 * and slow to draw. So a window longer than `DAY_RESOLUTION_FROM` days is bucketed
 * into days: the line becomes the day's mean with its minimum and maximum as a band
 * behind it, and rainfall becomes the day's total. That is more informative than the
 * hourly version at that width, not merely cheaper: nobody reads a thirty-day chart
 * for what happened at four in the morning on the ninth.
 *
 * A day is measured only if *every* hour in it that has data was measured. A day
 * half from a station and half from a model is not a measurement, and colouring it
 * as one would be the one mistake this whole module exists to prevent.
 *
 * Pure, and unit-agnostic: temperatures are °C, wind is km/h, rainfall is mm — the
 * app's own internal units — and the page converts at the point it draws, as every
 * other card does.
 */
import type { ForecastModel, Hour } from './types';
import type { MeasuredHour } from '../sources/agroexact';

/** Which quantity a chart is about. */
export type SeriesKey = 'temp' | 'precip' | 'humidity' | 'wind';

/** Bars for a total that accumulates, a line for a level that moves. */
export type SeriesShape = 'line' | 'bar';

export interface SeriesMeta {
  key: SeriesKey;
  shape: SeriesShape;
  /** Which of the two summaries the page prints: a range, or a total and a peak. */
  summary: 'range' | 'total';
}

export const SERIES_META: Record<SeriesKey, SeriesMeta> = {
  temp: { key: 'temp', shape: 'line', summary: 'range' },
  precip: { key: 'precip', shape: 'bar', summary: 'total' },
  humidity: { key: 'humidity', shape: 'line', summary: 'range' },
  wind: { key: 'wind', shape: 'line', summary: 'range' },
};

/** Beyond this many days the samples are days rather than hours. */
export const DAY_RESOLUTION_FROM = 3;

export interface Sample {
  /** `YYYY-MM-DDTHH:00` at hour resolution, `YYYY-MM-DD` at day resolution. */
  key: string;
  value: number | null;
  /** The spread inside a bucketed day. Absent at hour resolution. */
  band?: { lo: number; hi: number } | null;
  /** A second line above the first — gusts over mean wind. */
  secondary?: number | null;
  /** An instrument reported this, rather than a model. */
  measured: boolean;
  /** This has not happened yet. */
  future: boolean;
}

export interface Series {
  resolution: 'hour' | 'day';
  samples: Sample[];
  /** Null where the window contains no readable value at all. */
  stats: { min: number; max: number; avg: number; total: number } | null;
  /** True where any sample came from a station. */
  anyMeasured: boolean;
  /** Index of the first forecast sample, or -1 where the window is all in the past.
   *  The chart splits its line here. */
  forecastFrom: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD`, from a `Date` read as local wall-clock. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Every local hour from the start of `from` to the end of `to`.
 *
 * Stepped through UTC on purpose. These are wall-clock strings with no zone, so
 * stepping them as local dates would make the device's own daylight saving decide
 * what the *location's* hours are called. The cost is that a clock change day
 * generates the one hour that does not exist and misses the one that happens twice;
 * both land as a gap in the line rather than as a wrong value, which is the right
 * way round for a chart of measurements.
 */
export function hourKeys(from: string, to: string): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T23:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const out: string[] = [];
  for (let t = start; t <= end; t += 3600_000) {
    const d = new Date(t);
    out.push(
      `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:00`
    );
  }
  return out;
}

/** Whole days between two `YYYY-MM-DD` dates, inclusive of both ends. */
export function daySpan(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86_400_000) + 1;
}

/** What one hour reads for a quantity, from a station's record of it. */
function fromMeasured(key: SeriesKey, h: MeasuredHour): { value: number | null; secondary?: number | null } {
  switch (key) {
    case 'temp': return { value: h.temp };
    case 'precip': return { value: h.precip };
    case 'humidity': return { value: h.humidity };
    case 'wind': return { value: h.wind, secondary: h.gusts };
  }
}

/** The same, from a modelled or observed hour of the forecast. */
function fromModel(key: SeriesKey, h: Hour): { value: number | null; secondary?: number | null } {
  switch (key) {
    case 'temp': return { value: h.tempExact ?? h.temp };
    case 'precip': return { value: h.precip ?? null };
    case 'humidity': return { value: h.humidity };
    case 'wind': return { value: h.windExact ?? h.wind, secondary: h.gusts ?? null };
  }
}

export interface BuildSeriesInput {
  key: SeriesKey;
  /** The window, as local calendar days. */
  from: string;
  to: string;
  /** What the station measured, if there is one. Keyed on the way in. */
  measured: readonly MeasuredHour[];
  /** The forecast, for the hours no measurement covers and for everything ahead. */
  model: ForecastModel | null;
}

/**
 * Build the samples for one quantity over one window.
 *
 * The order of preference per hour is measurement, then model — and never the other
 * way round, because the whole promise of a station-backed location is that what it
 * reported wins over what was computed for it.
 */
export function buildSeries({ key, from, to, measured, model }: BuildSeriesInput): Series {
  const byMeasured = new Map(measured.map((h) => [h.time, h]));
  const byModel = new Map((model?.allHours ?? []).map((h) => [h.time, h]));
  const nowHour = model?.nowHour ?? '';

  const hours: Sample[] = hourKeys(from, to).map((time) => {
    const m = byMeasured.get(time);
    const future = nowHour !== '' && time > nowHour;
    // Measurements end at now by definition, so a future hour never consults them.
    if (m && !future) {
      const { value, secondary } = fromMeasured(key, m);
      // A station that reported the hour but not this quantity leaves the model to
      // answer for it: the merge is per quantity everywhere else in the app too.
      if (value != null) return { key: time, value, secondary, measured: true, future };
    }
    const h = byModel.get(time);
    if (!h) return { key: time, value: null, measured: false, future };
    const { value, secondary } = fromModel(key, h);
    return { key: time, value, secondary, measured: false, future };
  });

  const span = daySpan(from, to);
  const samples = span > DAY_RESOLUTION_FROM ? bucketByDay(key, hours) : hours;

  return {
    resolution: span > DAY_RESOLUTION_FROM ? 'day' : 'hour',
    samples,
    stats: summarise(samples),
    anyMeasured: samples.some((s) => s.measured),
    forecastFrom: samples.findIndex((s) => s.future),
  };
}

/**
 * Fold hourly samples into one per calendar day.
 *
 * Rainfall sums, because that is what rainfall does; everything else averages and
 * keeps its extremes as a band, because a day's mean temperature alone throws away
 * the thing a reader is looking for. Gusts take the day's peak rather than its mean
 * for the same reason — the point of a gust is that it was the strongest.
 */
function bucketByDay(key: SeriesKey, hours: readonly Sample[]): Sample[] {
  const days = new Map<string, Sample[]>();
  for (const h of hours) {
    const day = h.key.slice(0, 10);
    const bucket = days.get(day);
    if (bucket) bucket.push(h);
    else days.set(day, [h]);
  }

  return [...days.entries()].map(([day, list]) => {
    const withValue = list.filter((s) => s.value != null);
    const values = withValue.map((s) => s.value as number);
    const gusts = list.map((s) => s.secondary).filter((v): v is number => v != null);

    if (!values.length) {
      return { key: day, value: null, band: null, measured: false, future: list.every((s) => s.future) };
    }

    const total = values.reduce((a, b) => a + b, 0);
    const lo = Math.min(...values);
    const hi = Math.max(...values);

    return {
      key: day,
      value: key === 'precip' ? round1(total) : round1(total / values.length),
      // A total has no spread to show, and a band drawn round one would suggest the
      // day rained somewhere between its own two ends.
      band: key === 'precip' || lo === hi ? null : { lo, hi },
      secondary: gusts.length ? Math.max(...gusts) : null,
      // Every hour that had a value had a measured one — see the note at the top.
      measured: withValue.every((s) => s.measured),
      future: withValue.every((s) => s.future),
    };
  });
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function summarise(samples: readonly Sample[]): Series['stats'] {
  const values = samples.map((s) => s.value).filter((v): v is number => v != null);
  if (!values.length) return null;
  const total = values.reduce((a, b) => a + b, 0);
  return {
    min: round1(Math.min(...values)),
    max: round1(Math.max(...values)),
    avg: round1(total / values.length),
    total: round1(total),
  };
}
