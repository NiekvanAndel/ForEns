/**
 * The days that have already happened, as rows for the table on 'Verwachting'.
 *
 * The page is a column of days, and it used to start at today. A grower reading it
 * asks "how much rain did we get" at least as often as "how much are we getting", and
 * the answer was on another page in another shape. So the same table now carries the
 * last two days as well, above the forecast and drawn exactly like it.
 *
 * ## Measured where there is an instrument, modelled where there is not
 *
 * On a location an AgroExact station speaks for, the figures are that station's own
 * hourly record. Everywhere else — and for any hour the station was quiet — they come
 * from Open-Meteo's observation feed. The merge is per hour and per quantity, which is
 * the rule the rest of the app already follows: a station that reported temperature
 * but not rainfall leaves rainfall to the model rather than to a gap.
 *
 * Two things are never the station's, whatever it reported: the weather code and the
 * sunshine. A weather station has no opinion about whether the day was "overcast" and
 * no radiometer calibrated to sunshine minutes, so the icon and the sunshine hours are
 * the model's on every row.
 *
 * A day counts as measured only where the station answered for every hour that has
 * data at all. Half from an instrument and half from a model is not a measurement, and
 * labelling it as one is the mistake this distinction exists to prevent.
 *
 * ## Why a `Day`, and not a shape of its own
 *
 * Because then the rows do not have to know. `OverviewDayRow` and `LayerDayRow` read a
 * day through `resolveDayValues`, and a past day is simply one where a deterministic
 * value is known and the ensemble is irrelevant — which is exactly the `useHarm` case
 * that rule already has. So the figures go in the `harm*` fields and come straight back
 * out, with no `~` and nothing to resolve.
 *
 * The percentile fields are filled with the measured value itself rather than left at
 * zero. They are never drawn — `ensLoaded` is false, and `layerBeam` draws no band
 * without it — but `beamScale` reads them to size the column, and a row of zeros there
 * would drag a week's temperature axis down to freezing.
 */
import { isHourDay } from '../solar';
import type { DetailHour } from './dayDetail';
import type { Day } from './types';
import type { MeasuredHour } from '../sources/agroexact';

/**
 * One hour that has happened, from whichever source answered for it.
 *
 * A neutral shape on purpose: the station and the model report different sets, and
 * this is the intersection plus the three only a model has.
 */
export interface PastHour {
  /** Local wall-clock hour, `YYYY-MM-DDTHH:00`. */
  time: string;
  temp: number | null;
  /** The spread inside the hour, where the source reports one. */
  tempMin?: number | null;
  tempMax?: number | null;
  humidity: number | null;
  humidityMin?: number | null;
  humidityMax?: number | null;
  precip: number | null;
  wind: number | null;
  /** The hour's peak gust, where the source reports one. */
  gusts?: number | null;
  windDir: number | null;
  dewpoint?: number | null;
  /** Model only. See the note above. */
  wmo?: number | null;
  sunMin?: number | null;
  et0?: number | null;
  /** True where an instrument reported this hour's readings. */
  measured: boolean;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const round1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * The station's hours and the model's, merged into one record of what happened.
 *
 * Per quantity, not per hour wholesale: the station wins for anything it reported and
 * the model fills the rest, so an instrument that lost its rain gauge still speaks for
 * the temperature. The weather code, the sunshine and the evaporation are the model's
 * on every hour regardless.
 */
export function mergePastHours(
  measured: readonly MeasuredHour[],
  modelled: readonly PastHour[]
): PastHour[] {
  const byTime = new Map<string, PastHour>();
  for (const h of modelled) byTime.set(h.time, { ...h, measured: false });

  for (const m of measured) {
    const model = byTime.get(m.time);
    const anyReading =
      num(m.temp) != null || num(m.humidity) != null ||
      num(m.wind) != null || num(m.precip) != null;
    if (!anyReading) continue;
    byTime.set(m.time, {
      time: m.time,
      temp: num(m.temp) ?? model?.temp ?? null,
      // No fallback for these two: the model reports one temperature an hour and no
      // spread inside it, so where the station has none there is none to be had.
      tempMin: num(m.tempMin),
      tempMax: num(m.tempMax),
      humidity: num(m.humidity) ?? model?.humidity ?? null,
      humidityMin: num(m.humidityMin),
      humidityMax: num(m.humidityMax),
      precip: num(m.precip) ?? model?.precip ?? null,
      wind: num(m.wind) ?? model?.wind ?? null,
      gusts: num(m.gusts) ?? model?.gusts ?? null,
      windDir: num(m.windDir) ?? model?.windDir ?? null,
      dewpoint: num(m.dewpoint) ?? model?.dewpoint ?? null,
      wmo: model?.wmo ?? null,
      sunMin: model?.sunMin ?? null,
      et0: model?.et0 ?? null,
      // Keyed on temperature, which every row on this page leads with: an hour the
      // station could not put a number on is an hour the model spoke for, whatever
      // else the station managed. A day is measured where every one of its hours is,
      // which is the conservative direction and the right one for a claim about
      // instruments.
      measured: num(m.temp) != null,
    });
  }

  return [...byTime.values()].sort((a, b) => (a.time < b.time ? -1 : 1));
}

/** The most frequent daylight weather code, ties going to the higher one — the same
 *  rule the forecast's own day icons use, applied to the hours as they happened. */
function dayIconOf(hours: readonly PastHour[], lat: number, offsetSec: number): number | null {
  const counts = new Map<number, number>();
  for (const h of hours) {
    const code = num(h.wmo);
    if (code == null || !isHourDay(h.time, lat, offsetSec)) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestN = -1;
  for (const [code, n] of counts) {
    if (n > bestN || (n === bestN && code > (best ?? -1))) {
      best = code;
      bestN = n;
    }
  }
  return best;
}

const minOf = (values: readonly (number | null | undefined)[]): number | null => {
  const v = values.map(num).filter((x): x is number => x != null);
  return v.length ? Math.min(...v) : null;
};
const maxOf = (values: readonly (number | null | undefined)[]): number | null => {
  const v = values.map(num).filter((x): x is number => x != null);
  return v.length ? Math.max(...v) : null;
};
const sumOf = (values: readonly (number | null | undefined)[]): number | null => {
  const v = values.map(num).filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
};

/**
 * A bearing's mean, as a vector rather than as an arithmetic average.
 *
 * North-west and north-east average to due south, which is the one direction the wind
 * was never blowing from. `core/model/series` has the same function for the same
 * reason; it is four lines and not worth a shared module between two callers that
 * would then both import a "circular statistics" file.
 */
function circularMean(degrees: readonly number[]): number | null {
  if (!degrees.length) return null;
  const rad = Math.PI / 180;
  let x = 0;
  let y = 0;
  for (const d of degrees) {
    x += Math.cos(d * rad);
    y += Math.sin(d * rad);
  }
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return null;
  return Math.round((Math.atan2(y, x) / rad + 360) % 360);
}

export interface PastDaysInput {
  /** The days to build, oldest first, as `YYYY-MM-DD`. */
  dates: readonly string[];
  hours: readonly PastHour[];
  lat: number;
  offsetSec: number;
}

/**
 * One row per date, in the order given, skipping any date with nothing to say.
 *
 * A day with no readings at all is left out rather than drawn empty: a row of dashes
 * above a forecast reads as a failure of the app, and a missing row reads as what it
 * is — the record does not go back that far.
 */
export function buildPastDays({ dates, hours, lat, offsetSec }: PastDaysInput): Day[] {
  const byDay = new Map<string, PastHour[]>();
  for (const h of hours) {
    const key = h.time.slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(h);
    else byDay.set(key, [h]);
  }

  const out: Day[] = [];
  for (const date of dates) {
    const list = byDay.get(date) ?? [];
    const withValue = list.filter((h) => num(h.temp) != null || num(h.precip) != null);
    if (!withValue.length) continue;

    // The day's extremes reach as far as the hours' own do: the coldest minute was
    // inside some hour's minimum, not at the lowest hourly mean.
    const tempMin = minOf(list.flatMap((h) => [h.tempMin, h.temp]));
    const tempMax = maxOf(list.flatMap((h) => [h.tempMax, h.temp]));
    const rhMin = minOf(list.flatMap((h) => [h.humidityMin, h.humidity]));
    const rhMax = maxOf(list.flatMap((h) => [h.humidityMax, h.humidity]));
    const precip = sumOf(list.map((h) => h.precip));
    const windMax = maxOf(list.map((h) => h.wind));
    const sunMin = sumOf(list.map((h) => h.sunMin));
    const et0 = sumOf(list.map((h) => h.et0));
    const windDir = circularMean(
      list.map((h) => num(h.windDir)).filter((v): v is number => v != null)
    );
    const icon = dayIconOf(list, lat, offsetSec);

    out.push(
      pastDay({
        date,
        measured: withValue.every((h) => h.measured),
        tempMin,
        tempMax,
        precip: precip != null ? round1(precip) : null,
        windMax,
        rhMin,
        rhMax,
        sunHours: sunMin != null ? round1(sunMin / 60) : null,
        et0: et0 != null ? round1(et0) : null,
        windDir,
        wmo: icon,
      })
    );
  }
  return out;
}

interface PastDayFigures {
  date: string;
  measured: boolean;
  tempMin: number | null;
  tempMax: number | null;
  precip: number | null;
  windMax: number | null;
  rhMin: number | null;
  rhMax: number | null;
  sunHours: number | null;
  et0: number | null;
  windDir: number | null;
  wmo: number | null;
}

/**
 * The figures, dressed as the `Day` the rows already know how to read.
 *
 * `useHarm` is the switch that makes `resolveDayValues` take the deterministic value
 * and stop — which is what a day that has happened needs. It does mean a past row
 * reports its source as HARMONIE-AROME if anything ever asks, so nothing does: past
 * rows do not open the day sheet, which is the only place that label is printed.
 */
function pastDay(f: PastDayFigures): Day {
  // Never drawn (see the note at the top) but read by `beamScale`, so they carry the
  // value rather than a zero.
  const at = (v: number | null) => (v ?? NaN);

  return {
    date: f.date,
    past: true,
    pastMeasured: f.measured,
    useHarm: true,
    ensLoaded: false,
    nMembers: 0,

    harmTempMin: f.tempMin,
    harmTempMax: f.tempMax,
    harmPrecip: f.precip,
    harmWindMax: f.windMax,
    harmRhMin: f.rhMin,
    harmRhMax: f.rhMax,
    hresRhMin: f.rhMin,
    hresRhMax: f.rhMax,

    tempLo: at(f.tempMin),
    tempHi: at(f.tempMax),
    tempMinP10: at(f.tempMin), tempMinP25: at(f.tempMin), tempMinP50: at(f.tempMin),
    tempMinP75: at(f.tempMin), tempMinP90: at(f.tempMin),
    tempMaxP10: at(f.tempMax), tempMaxP25: at(f.tempMax), tempMaxP50: at(f.tempMax),
    tempMaxP75: at(f.tempMax), tempMaxP90: at(f.tempMax),
    precipP10: at(f.precip), precipP25: at(f.precip), precipMedian: at(f.precip),
    precipP75: at(f.precip), precipP90: at(f.precip),
    windP10: at(f.windMax), windP25: at(f.windMax), windP50: at(f.windMax),
    windP75: at(f.windMax), windP90: at(f.windMax),
    humidityMedian: f.rhMax, humidityP10: f.rhMin, humidityP25: f.rhMin,
    humidityP75: f.rhMax, humidityP90: f.rhMax,

    // It either rained or it did not, which is what a day that has happened knows.
    pChance: f.precip != null && f.precip >= 0.1 ? 100 : 0,
    p5mm: f.precip != null && f.precip >= 5 ? 100 : 0,
    p20mm: f.precip != null && f.precip >= 20 ? 100 : 0,

    sunHours: f.sunHours,
    et0: f.et0,
    windDir: f.windDir,
    wmo: f.wmo ?? 0,
    dayIcon: f.wmo,
    sunModel: null,
    sunOpacity: null,
    sunOpacityDerived: false,
    sun6Hourly: null,
  };
}

/**
 * A past day's hours, in the shape the hourly list already reads.
 *
 * `HourlyList` is written against `DetailHour`, which is what `buildDayDetail`
 * produces for a forecast day. A day that has happened has the same hours in it and
 * nothing extra — no ensemble, and no three-hourly stretch where the model thins out —
 * so it is a conversion rather than a second list component.
 */
export function pastDetailHours(
  hours: readonly PastHour[],
  date: string
): DetailHour[] {
  return hours
    .filter((h) => h.time.slice(0, 10) === date)
    .map((h) => ({
      time: h.time,
      hour: parseInt(h.time.slice(11, 13), 10),
      precip: num(h.precip) ?? 0,
      wmo: num(h.wmo) ?? 0,
      temp: num(h.temp),
      wind: num(h.wind),
      gusts: num(h.gusts),
      windDir: num(h.windDir),
      humidity: num(h.humidity),
      dewpoint: num(h.dewpoint),
      sunMin: num(h.sunMin),
      et0h: num(h.et0),
      isPast: true,
      is3h: false,
    }));
}
