/**
 * Forecast layers.
 *
 * The design's ForecastScreen has a six-way layer switcher, but in the mock it is
 * decorative: `DayRow` renders identically whichever layer is selected. This module
 * makes it real by describing, per layer, what a day row actually shows — the value,
 * the bar, and the ensemble spread behind it.
 *
 * Values come from `resolveDayValues`, which applies the web app's rule for deciding
 * *which model speaks* for a day: HARMONIE for days 0–1, IFS unconditionally on days
 * 2–3, and from day 4 the deterministic run only when it falls inside the ensemble
 * band — otherwise the ensemble median, flagged so the UI can mark it `~`.
 *
 * It is pure so the arithmetic is testable without a renderer, and so the same
 * description can drive the widget.
 *
 * Values stay in canonical units (°C, mm, km/h, hours, %); conversion to the user's
 * preference happens at render, once.
 */
import type { Day } from './types';
import { resolveDayValues, type DayValues } from './dayValues';

export type LayerKey = 'overview' | 'temp' | 'precip' | 'wind' | 'sun' | 'humidity';

export const LAYERS: ReadonlyArray<{ key: LayerKey; icon: string; labelKey: string }> = [
  { key: 'overview', icon: 'info', labelKey: 'tabOverview' },
  { key: 'temp', icon: 'thermometer-simple', labelKey: 'tabTemp' },
  { key: 'precip', icon: 'drop', labelKey: 'tabPrecip' },
  { key: 'wind', icon: 'wind', labelKey: 'tabWind' },
  { key: 'sun', icon: 'sun', labelKey: 'tabSun' },
  { key: 'humidity', icon: 'drop-half', labelKey: 'tabHumidity' },
];

export interface Range {
  lo: number;
  hi: number;
}

export interface LayerRow {
  /** The headline number for the row, in canonical units. */
  primary: number | null;
  /** A second number shown beside it, where the layer has one. */
  secondary: number | null;
  /** The filled band, in the layer's own units, or null when there is nothing to draw. */
  band: Range | null;
  /** The p10–p90 ensemble whisker behind the band, when the ensemble has loaded. */
  spread: Range | null;
  /** A short qualifier, e.g. a precipitation probability. */
  note: string | null;
  /** False when the ensemble median stood in for an out-of-band deterministic run.
   *  The UI marks these `~`, as the web app does. */
  primaryDirect: boolean;
  secondaryDirect: boolean;
  /** Everything the overview row needs, resolved once. */
  values: DayValues;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** An ensemble field, but only once the ensemble has actually loaded.
 *
 *  processAll rounds a missing percentile through `Math.round(null)`, which is 0 —
 *  so before the ensemble lands every percentile field reads as a real zero rather
 *  than as absent. Without this guard a day would render "0°" instead of blank
 *  during the second or two the ensemble is in flight. */
function ens(d: Day, value: unknown): number | null {
  return d.ensLoaded ? num(value) : null;
}

export function layerRow(
  day: Day,
  layer: LayerKey,
  showSpread = true,
  dayIndex = 0
): LayerRow {
  const values = resolveDayValues(day, { dayIndex });
  const spread = <T extends Range>(r: T | null): Range | null =>
    showSpread && day.ensLoaded ? r : null;

  const base = {
    values,
    primaryDirect: true,
    secondaryDirect: true,
  };

  switch (layer) {
    // The overview row shows every measurand at once, so it has no single bar.
    // `LayerDayRow` renders it as its own layout rather than through band/spread.
    case 'overview':
      return {
        ...base,
        primary: values.tempMax.value,
        secondary: values.tempMin.value,
        primaryDirect: values.tempMax.direct,
        secondaryDirect: values.tempMin.direct,
        band:
          values.tempMin.value != null && values.tempMax.value != null
            ? { lo: values.tempMin.value, hi: values.tempMax.value }
            : null,
        spread: null,
        note: null,
      };

    case 'temp': {
      const lo = values.tempMin.value;
      const hi = values.tempMax.value;
      return {
        ...base,
        primary: hi,
        secondary: lo,
        primaryDirect: values.tempMax.direct,
        secondaryDirect: values.tempMin.direct,
        band: lo != null && hi != null ? { lo, hi } : null,
        spread: spread(
          ens(day, day.tempMinP10) != null && ens(day, day.tempMaxP90) != null
            ? { lo: day.tempMinP10, hi: day.tempMaxP90 }
            : null
        ),
        note: null,
      };
    }

    case 'precip': {
      const value = values.precip.value;
      const chance = ens(day, day.pChance);
      return {
        ...base,
        primary: value,
        secondary: null,
        primaryDirect: values.precip.direct,
        band: value != null ? { lo: 0, hi: value } : null,
        spread: spread(
          ens(day, day.precipP10) != null && ens(day, day.precipP90) != null
            ? { lo: day.precipP10, hi: day.precipP90 }
            : null
        ),
        note: chance != null ? `${Math.round(chance)}%` : null,
      };
    }

    case 'wind': {
      const value = values.wind.value;
      return {
        ...base,
        primary: value,
        secondary: num(day.hresWindMax),
        primaryDirect: values.wind.direct,
        band: value != null ? { lo: 0, hi: value } : null,
        spread: spread(
          ens(day, day.windP10) != null && ens(day, day.windP90) != null
            ? { lo: day.windP10, hi: day.windP90 }
            : null
        ),
        note: null,
      };
    }

    case 'sun': {
      const hours = values.sunHours;
      return {
        ...base,
        primary: hours,
        secondary: values.et0,
        band: hours != null ? { lo: 0, hi: hours } : null,
        // Sunshine comes from a deterministic run, not the ensemble, so there is no
        // spread to draw here however the preference is set.
        spread: null,
        note: null,
      };
    }

    case 'humidity': {
      const lo = values.humidityMin.value;
      const hi = values.humidityMax.value;
      return {
        ...base,
        primary: ens(day, day.humidityMedian) ?? (lo != null && hi != null ? (lo + hi) / 2 : null),
        secondary: null,
        primaryDirect: values.humidityMax.direct,
        secondaryDirect: values.humidityMin.direct,
        band: lo != null && hi != null ? { lo, hi } : null,
        spread: null,
        note: lo != null && hi != null ? `${Math.round(lo)}–${Math.round(hi)}%` : null,
      };
    }
  }
}

/**
 * The shared scale a layer's bars are drawn against.
 *
 * One scale across all visible days is what makes the column comparable: a wet day
 * should look wetter than a dry one, which it cannot if every bar fills its own row.
 * Spread whiskers are included so a wide ensemble is not clipped.
 */
export function layerScale(days: readonly Day[], layer: LayerKey, showSpread = true): Range {
  let lo = Infinity;
  let hi = -Infinity;

  days.forEach((d, i) => {
    const row = layerRow(d, layer, showSpread, i);
    for (const r of [row.band, row.spread]) {
      if (!r) continue;
      if (Number.isFinite(r.lo)) lo = Math.min(lo, r.lo);
      if (Number.isFinite(r.hi)) hi = Math.max(hi, r.hi);
    }
  });

  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    // Nothing to scale against yet; a unit range keeps every downstream division safe.
    return { lo: 0, hi: 1 };
  }

  // Quantity layers read against zero; temperature and humidity read against their
  // own range, because a 4-degree day and a 6-degree day must look different.
  if (layer === 'precip' || layer === 'wind' || layer === 'sun') lo = 0;

  if (hi <= lo) hi = lo + 1;
  return { lo, hi };
}

/** Position and width of a band within a scale, as fractions of the track (0–1). */
export function bandGeometry(band: Range | null, scale: Range): { left: number; width: number } | null {
  if (!band) return null;
  const span = scale.hi - scale.lo || 1;
  const left = Math.min(1, Math.max(0, (band.lo - scale.lo) / span));
  const right = Math.min(1, Math.max(0, (band.hi - scale.lo) / span));
  return { left, width: Math.max(0.01, right - left) };
}

export { resolveDayValues };
export type { DayValues };
