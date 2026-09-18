/**
 * What the overview page's widgets are made of: one row per saved location, and the
 * handful of readings every widget picks from.
 *
 * Built once and passed down, rather than each widget reaching into a `ForecastModel`
 * and working out "the last 24 hours" for itself. Twelve widgets each deriving the
 * same figure is twelve chances for two of them to disagree about the same field on
 * the same screen, which is the one thing a summary page must not do.
 *
 * Pure, and in canonical units — °C, km/h, mm. The page converts where it draws, as
 * every other surface in this app does.
 */
import type { EnsembleOutlook } from './sources/ensembleOutlook';
import { threshold } from './thresholds';
import { measuredQuantities, type MeasuredQuantities } from './model/station';
import type { ForecastModel, Hour } from './model/types';

/** A short forecast for one location, beyond what the observation feed carries. */
export interface LocationOutlook {
  /** The coming days, nearest first. */
  days: OutlookDay[];
  /** Hour by hour from now, for the spray window and tonight's minimum. */
  hours: OutlookHour[];
}

export interface OutlookDay {
  /** `YYYY-MM-DD`, local. */
  date: string;
  tempMin: number | null;
  tempMax: number | null;
  precip: number | null;
  windMax: number | null;
  wmo: number | null;
}

export interface OutlookHour {
  /** Local wall-clock, `YYYY-MM-DDTHH:MM`. */
  time: string;
  temp: number | null;
  /** Relative humidity, %. Delta T — and so the spray window — is unreadable
   *  without it, which is why the short outlook carries it. */
  humidity: number | null;
  precip: number | null;
  wind: number | null;
  gusts: number | null;
  /** 1 by day, 0 by night. What the inversion proxy reads. */
  isDay: 0 | 1 | null;
}

/** One saved location, as every widget on the page reads it. */
export interface OverviewRow {
  /** Its slot in the saved list — what selecting it needs. */
  index: number;
  name: string;
  /** True where an instrument of any kind stands at this location. Not the green
   *  dot — that is per quantity, below. */
  hasStation: boolean;
  /**
   * Which figures on this row an instrument actually reported.
   *
   * The green dot's rule, and the same one the blocks on 'Actueel' use. It used to be
   * `hasStation` here, which was wrong in both directions at once: a rain gauge's page
   * put a dot on its modelled temperature, and a field with a soil sensor got no dot
   * at all on rain it had measured itself.
   *
   * Nothing about the future is in here. No instrument reports tomorrow, so every
   * widget built on the outlook or the ensemble draws no dot whatever stands there.
   */
  measured: MeasuredQuantities;
  loading: boolean;

  tempC: number | null;
  humidity: number | null;
  windKmh: number | null;
  gustKmh: number | null;
  windDir: number | null;
  wmo: number | null;

  /** Millimetres over the trailing 24 hours, and over the calendar day so far. */
  rain24: number | null;
  rainToday: number | null;

  /** Everything below needs the outlook, and is null without it. */
  rainNext24: number | null;
  tonightMinC: number | null;
  days: OutlookDay[];
  hours: OutlookHour[];

  /** The last 24 hours of rainfall, hour by hour, for a sparkline. Oldest first. */
  rainTrail: (number | null)[];
  /** The same for temperature, so a card can show the shape of the day behind the
   *  figure rather than only the figure. */
  tempTrail: (number | null)[];

  /** Where the members put the coming days' rain. Null without the ensemble source. */
  ensemble: EnsembleOutlook | null;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const round1 = (v: number) => Math.round(v * 10) / 10;

const sumPrecip = (hours: readonly { precip?: number | null }[]): number | null => {
  const v = hours.map((h) => h.precip).filter(isNum);
  return v.length ? round1(v.reduce((a, b) => a + b, 0)) : null;
};

export interface BuildRowInput {
  index: number;
  name: string;
  hasStation: boolean;
  /** Whether a soil sensor answered for the rainfall — see `applySoilPrecip`. */
  precipMeasured?: boolean;
  loading: boolean;
  model: ForecastModel | null;
  outlook: LocationOutlook | null;
  ensemble?: EnsembleOutlook | null;
}

/**
 * One row from whatever has landed for that location.
 *
 * Every field is independently null, because the sources land independently: the
 * conditions arrive before the outlook, and a widget that reads only the first should
 * not wait on the second. A row is therefore always drawable and never complete —
 * which is the honest shape for a page assembled from a request per location.
 */
export function buildOverviewRow(input: BuildRowInput): OverviewRow {
  const { model, outlook } = input;
  const now: Hour | undefined = model?.allHours.find((h) => h.time === model.nowHour)
    ?? model?.pastHours[model.pastHours.length - 1];

  const past24 = model?.pastHours.slice(-24) ?? [];
  const today = model
    ? model.allHours.filter(
        (h) => h.time.slice(0, 10) === model.nowHour.slice(0, 10) && h.time <= model.nowHour
      )
    : [];

  return {
    index: input.index,
    name: input.name,
    hasStation: input.hasStation,
    measured: measuredQuantities(model, input.precipMeasured),
    loading: input.loading,

    tempC: now?.tempExact ?? now?.temp ?? null,
    humidity: now?.humidity ?? null,
    windKmh: now?.windExact ?? now?.wind ?? null,
    gustKmh: now?.gusts ?? null,
    windDir: now?.windDir ?? null,
    wmo: now?.wmo ?? null,

    rain24: sumPrecip(past24),
    rainToday: sumPrecip(today),

    rainNext24: outlook ? sumPrecip(outlook.hours.slice(0, 24)) : null,
    tonightMinC: outlook ? tonightMinimum(outlook.hours) : null,
    days: outlook?.days ?? [],
    hours: outlook?.hours ?? [],

    rainTrail: past24.map((h) => h.precip ?? null),
    tempTrail: past24.map((h) => h.tempExact ?? h.temp ?? null),

    ensemble: input.ensemble ?? null,
  };
}

/**
 * The lowest temperature between this evening and tomorrow morning.
 *
 * The night hours inside the next eighteen, rather than "the lowest of the next
 * twelve". A grower asking this is asking about *the coming night*, and the answer
 * must not change meaning with the time of day: asked at noon it looks ahead to
 * tonight, asked at three in the morning it is already inside the window it is about.
 * Eighteen hours is what reaches tomorrow morning from an evening glance without
 * reaching the night after.
 */
export function tonightMinimum(hours: readonly OutlookHour[], count = 18): number | null {
  const temps = hours
    .slice(0, count)
    .filter((h) => {
      const hour = Number(h.time.slice(11, 13));
      return hour >= NIGHT_FROM || hour <= NIGHT_TO;
    })
    .map((h) => h.temp)
    .filter(isNum);
  return temps.length ? Math.min(...temps) : null;
}

/** The night, in local hours. Wide enough that a late frost at 08:00 is inside it. */
const NIGHT_FROM = 18;
const NIGHT_TO = 9;

/** Sort rows by a reading, largest first, with the ones that have none at the back —
 *  a location that is not reporting is not a location with the least rain. */
export function rankRows(
  rows: readonly OverviewRow[],
  pick: (row: OverviewRow) => number | null,
  direction: 'desc' | 'asc' = 'desc'
): OverviewRow[] {
  return [...rows].sort((a, b) => {
    const x = pick(a);
    const y = pick(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return direction === 'desc' ? y - x : x - y;
  });
}

/**
 * When a field can be worked, hour by hour.
 *
 * Three conditions, and they are the three a sprayer's label and a grower's judgement
 * actually name: it has to be dry, the wind has to be down, and it must not be
 * freezing. Anything more — a drying window, a soil temperature, a crop stage — needs
 * data the app does not have, and inventing it here would be a confident answer to a
 * question nobody asked.
 *
 * The thresholds are arguments rather than constants because they are the first thing
 * a grower will want to set for themselves, and the second thing a crop will want
 * different from another.
 */
export interface WorkWindowLimits {
  /** Millimetres in the hour that makes it too wet. */
  wetMm: number;
  /** Wind, km/h, above which spraying drifts. */
  windKmh: number;
  /** Below this it is too cold, °C. */
  minTempC: number;
}

export const DEFAULT_WORK_LIMITS: WorkWindowLimits = {
  wetMm: threshold('workWindow.wet'),
  windKmh: threshold('workWindow.wind'),
  minTempC: threshold('workWindow.minTemp'),
};

export type WorkVerdict = 'yes' | 'wet' | 'windy' | 'cold' | 'unknown';

export interface WorkHour {
  time: string;
  verdict: WorkVerdict;
}

/**
 * The verdict per hour, for the next `count` hours.
 *
 * Ordered: wet beats windy beats cold, because that is the order in which they stop
 * the work. An hour missing any of the three is `unknown` rather than `yes` — a gap
 * in the forecast is not a green light.
 */
export function workWindow(
  hours: readonly OutlookHour[],
  limits: WorkWindowLimits = DEFAULT_WORK_LIMITS,
  count = 24
): WorkHour[] {
  return hours.slice(0, count).map((h) => {
    if (!isNum(h.precip) || !isNum(h.wind) || !isNum(h.temp)) {
      return { time: h.time, verdict: 'unknown' as const };
    }
    if (h.precip >= limits.wetMm) return { time: h.time, verdict: 'wet' as const };
    if (h.wind > limits.windKmh) return { time: h.time, verdict: 'windy' as const };
    if (h.temp < limits.minTempC) return { time: h.time, verdict: 'cold' as const };
    return { time: h.time, verdict: 'yes' as const };
  });
}

/** The first run of workable hours, as a start and a length — what a grower plans
 *  around, rather than a count of scattered green hours. */
export function firstWorkRun(window: readonly WorkHour[]): { from: string; hours: number } | null {
  let start = -1;
  for (let i = 0; i < window.length; i++) {
    const ok = window[i]?.verdict === 'yes';
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) return { from: window[start]!.time, hours: i - start };
  }
  return start >= 0 ? { from: window[start]!.time, hours: window.length - start } : null;
}

/**
 * The page in facts, for the sentence at the top.
 *
 * Facts and not a sentence: the wording belongs in `core/i18n` with every other
 * string, and a summariser that returned Dutch would be the third thing in this app
 * to have to be translated after the fact.
 */
export interface OverviewSummary {
  locations: number;
  /** Coldest and warmest reading across the locations, right now. */
  coldest: { name: string; value: number } | null;
  warmest: { name: string; value: number } | null;
  /** Where most fell over the last 24 hours, when anywhere did. */
  wettest: { name: string; value: number } | null;
  /** Locations expecting a millimetre or more in the next 24. */
  rainAhead: string[];
  /** True while nothing has landed yet, so the sentence can wait rather than claim
   *  every field is dry. */
  loading: boolean;
}

/** A millimetre is the point below which "it rains" is not worth saying to somebody
 *  deciding whether to go out. */
const RAIN_AHEAD_MM = 1;

export function summariseOverview(rows: readonly OverviewRow[]): OverviewSummary {
  const withTemp = rows.filter((r) => isNum(r.tempC));
  const ranked = rankRows(withTemp, (r) => r.tempC);
  const wet = rankRows(rows.filter((r) => isNum(r.rain24) && (r.rain24 as number) > 0), (r) => r.rain24);
  const top = wet[0];

  return {
    locations: rows.length,
    warmest: ranked[0] ? { name: ranked[0].name, value: ranked[0].tempC as number } : null,
    coldest: ranked.length
      ? { name: ranked[ranked.length - 1]!.name, value: ranked[ranked.length - 1]!.tempC as number }
      : null,
    wettest: top ? { name: top.name, value: top.rain24 as number } : null,
    rainAhead: rows
      .filter((r) => isNum(r.rainNext24) && (r.rainNext24 as number) >= RAIN_AHEAD_MM)
      .map((r) => r.name),
    loading: rows.length > 0 && rows.every((r) => r.loading),
  };
}


// ── Which locations are worth the space ──────────────────────────────────────

/**
 * A widget's rows, split into the ones with something to say and a count of the rest.
 *
 * The page's hardest constraint is not data, it is height. A grower with eight fields
 * scrolling past eight lines of "0,0 mm" learns that the rainfall widget is mostly
 * noise, and stops reading it on the morning it is not. So a widget shows the
 * locations that clear its own bar and closes with one line for the others — which is
 * both shorter and more informative, because "and five others dry" is a fact and five
 * zeroes are a list.
 *
 * The bar is the widget's to choose, because "worth mentioning" is different for
 * rainfall and for frost. What is shared is the shape of the answer.
 */
export interface NotableRows {
  shown: OverviewRow[];
  /** How many were left out — never listed, only counted. */
  rest: number;
  /** True where nothing cleared the bar, so the widget can say so in a sentence
   *  rather than draw an empty card. */
  empty: boolean;
}

export function notableRows(
  rows: readonly OverviewRow[],
  pick: (row: OverviewRow) => number | null,
  /** Clears the bar at or above this. */
  atLeast: number,
  direction: 'desc' | 'asc' = 'desc',
  /** Never show more than this many, however many clear it — a widget is a summary
   *  and eight lines is a page. */
  limit = 5
): NotableRows {
  const worth = rankRows(rows, pick, direction).filter((r) => {
    const v = pick(r);
    if (v == null) return false;
    return direction === 'desc' ? v >= atLeast : v <= atLeast;
  });
  const shown = worth.slice(0, limit);
  return { shown, rest: rows.length - shown.length, empty: worth.length === 0 };
}

/**
 * How far apart the locations are on one reading.
 *
 * A comparison widget earns its lines by showing a difference. Where every field is
 * within a degree of every other, the honest and shorter thing is one line saying so
 * — which is what `spreadOf` lets a widget decide.
 */
export function spreadOf(
  rows: readonly OverviewRow[],
  pick: (row: OverviewRow) => number | null
): { min: number; max: number; span: number } | null {
  const values = rows.map(pick).filter((v): v is number => v != null && Number.isFinite(v));
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, span: max - min };
}

/**
 * Which way a reading is going: the next 24 hours against the last 24.
 *
 * A real trend rather than a decorative arrow — for rainfall it answers "is it about
 * to get wetter than it has been", which is the question behind most of the others on
 * this page. Flat below a tenth, so a trace of drizzle does not point an arrow.
 */
export type Trend = 'up' | 'down' | 'flat';

export function trendOf(before: number | null, after: number | null, deadband = 0.1): Trend {
  if (before == null || after == null) return 'flat';
  const change = after - before;
  if (Math.abs(change) < deadband) return 'flat';
  return change > 0 ? 'up' : 'down';
}
