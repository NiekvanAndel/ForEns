/**
 * Which model speaks for a day.
 *
 * This is the rule `index.html` applies in every one of its day rows, and the part
 * the first port missed: it does not simply prefer the deterministic IFS run over
 * the ensemble. It asks whether the IFS value falls *inside* the ensemble band, and
 * where IFS is an outlier it substitutes the ensemble median instead — marking that
 * substitution with a `~` so the reader can see the deterministic run was overruled.
 *
 * The precedence, per measurand:
 *
 *   days 0–1  HARMONIE-AROME, when it has a value for that day
 *   days 2–3  IFS unconditionally (`forceIfs`) — too near for the ensemble to
 *             disagree usefully, and HARMONIE no longer reaches
 *   days 4+   IFS when it sits inside the ensemble band, else the ensemble median
 *
 * The band itself widens with lead time, inverted from what one might expect:
 * days 0–6 accept IFS anywhere in p10–p90, days 7+ only in p25–p75. Further out the
 * ensemble is trusted more and the deterministic run has to agree more closely.
 *
 * Ported faithfully, including one inconsistency: humidity omits the `|| !hasEns`
 * escape the other measurands have, so before the ensemble loads humidity falls back
 * to its deterministic value only on days 2–3. That is what the web app does, and a
 * port is not the place to quietly change it.
 */
import type { Day } from './types';

/** Below this index the ensemble band is p10–p90; at or beyond it, p25–p75. */
const WIDE_BAND_BEFORE_DAY = 7;
/** Up to this index the deterministic run is used without consulting the ensemble. */
const FORCE_IFS_THROUGH_DAY = 3;

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** True when `val` sits within [lo, hi], with any of them missing counting as false. */
export function inRange(
  val: number | null | undefined,
  lo: number | null | undefined,
  hi: number | null | undefined
): boolean {
  return val != null && lo != null && hi != null && val >= lo && val <= hi;
}

/** One resolved reading: the value, and whether it came from the ensemble median
 *  because the deterministic run fell outside the band. */
export interface Resolved {
  value: number | null;
  /** True when the deterministic value was used; false means the median stood in,
   *  which the UI marks with `~`. */
  direct: boolean;
}

export interface DayValues {
  tempMin: Resolved;
  tempMax: Resolved;
  precip: Resolved;
  wind: Resolved;
  humidityMin: Resolved;
  humidityMax: Resolved;
  windDir: number | null;
  wmo: number | null;
  sunHours: number | null;
  et0: number | null;
  /** Which model supplied the values, for the source line. */
  source: 'harmonie' | 'ifs' | 'ensemble';
}

export interface ResolveOptions {
  /** Position in the forecast, 0 being today. Decides band width and forceIfs. */
  dayIndex: number;
}

/**
 * Resolve every headline value for a day, following the web app's rule.
 */
export function resolveDayValues(day: Day, { dayIndex }: ResolveOptions): DayValues {
  const wide = dayIndex < WIDE_BAND_BEFORE_DAY;
  const hasEns = day.ensLoaded ?? false;
  const useHarm = day.useHarm;
  const forceIfs = !useHarm && dayIndex <= FORCE_IFS_THROUGH_DAY;

  /** The band a deterministic value must fall inside to be trusted. */
  const band = (p10: unknown, p25: unknown, p75: unknown, p90: unknown) =>
    wide
      ? { lo: num(p10), hi: num(p90) }
      : { lo: num(p25), hi: num(p75) };

  /** The shared pattern for temperature, precipitation and wind. */
  const resolve = (
    harmValue: unknown,
    hresValue: unknown,
    median: unknown,
    bounds: { lo: number | null; hi: number | null },
    harmFallback: () => number | null
  ): Resolved => {
    if (useHarm) {
      const direct = num(harmValue) != null;
      return { value: harmFallback(), direct };
    }
    const direct = forceIfs || !hasEns || inRange(num(hresValue), bounds.lo, bounds.hi);
    return { value: direct ? num(hresValue) : num(median), direct };
  };

  const tempMin = resolve(
    day.harmTempMin,
    day.hresTempMin,
    day.tempMinP50,
    band(day.tempMinP10, day.tempMinP25, day.tempMinP75, day.tempMinP90),
    () => num(day.harmTempMin) ?? num(day.hresTempMin) ?? num(day.tempMinP50)
  );

  const tempMax = resolve(
    day.harmTempMax,
    day.hresTempMax,
    day.tempMaxP50,
    band(day.tempMaxP10, day.tempMaxP25, day.tempMaxP75, day.tempMaxP90),
    () => num(day.harmTempMax) ?? num(day.hresTempMax) ?? num(day.tempMaxP50)
  );

  const wind = resolve(
    day.harmWindMax,
    day.hresWindMax,
    day.windP50,
    band(day.windP10, day.windP25, day.windP75, day.windP90),
    () => num(day.harmWindMax) ?? num(day.hresWindMax) ?? num(day.windP50)
  );

  // Precipitation differs slightly: the overview additionally requires the
  // deterministic value to exist before using it, and defaults to 0 rather than null.
  const precip: Resolved = (() => {
    if (useHarm) {
      return { value: num(day.harmPrecip) ?? 0, direct: num(day.harmPrecip) != null };
    }
    const b = band(day.precipP10, day.precipP25, day.precipP75, day.precipP90);
    const direct = forceIfs || !hasEns || inRange(num(day.hresPrecip), b.lo, b.hi);
    const hres = num(day.hresPrecip);
    return {
      value: direct && hres != null ? hres : num(day.precipMedian) ?? 0,
      direct,
    };
  })();

  // Humidity omits the `|| !hasEns` escape — faithful to index.html.
  const resolveRh = (
    harmValue: unknown,
    hresValue: unknown,
    fallback: unknown,
    harmFallbackDefault: number
  ): Resolved => {
    const b = band(day.humidityP10, day.humidityP25, day.humidityP75, day.humidityP90);
    if (useHarm) {
      const direct = num(harmValue) != null;
      return { value: num(harmValue) ?? num(day.humidityMedian) ?? harmFallbackDefault, direct };
    }
    const direct = forceIfs
      ? num(hresValue) != null
      : inRange(num(hresValue), b.lo, b.hi);
    return { value: direct ? num(hresValue) : num(fallback) ?? harmFallbackDefault, direct };
  };

  const humidityMin = resolveRh(day.harmRhMin, day.hresRhMin, day.humidityP10, 0);
  const humidityMax = resolveRh(day.harmRhMax, day.hresRhMax, day.humidityP90, 100);

  return {
    tempMin,
    tempMax,
    precip,
    wind,
    humidityMin,
    humidityMax,
    windDir: num(day.hresWindDir) ?? num(day.windDir),
    wmo: num(day.dayIcon) ?? num(day.hresWmo) ?? num(day.wmo),
    sunHours: num(day.sunHours),
    et0: num(day.et0),
    source: useHarm ? 'harmonie' : forceIfs ? 'ifs' : 'ensemble',
  };
}

/** Human label for which model spoke, for the day sheet's source line. */
export function sourceLabel(values: DayValues): string {
  return values.source === 'harmonie'
    ? 'HARMONIE-AROME'
    : values.source === 'ifs'
      ? 'ECMWF IFS'
      : 'ECMWF IFS / ENS';
}
