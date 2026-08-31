/**
 * Forecast layers.
 *
 * The design's ForecastScreen has a five-way layer switcher, but in the mock it is
 * decorative: `DayRow` renders identically whichever layer is selected. This module
 * makes it real by describing, per layer, what a day row actually shows — the value,
 * the bar, and the ensemble spread behind it.
 *
 * It is pure so the arithmetic is testable without a renderer, and so the same
 * description can drive the widget later.
 *
 * Values stay in canonical units (°C, mm, km/h, hours, %); conversion to the user's
 * preference happens at render, once.
 */
import type { Day } from './types';

export type LayerKey = 'temp' | 'precip' | 'wind' | 'sun' | 'humidity';

export const LAYERS: ReadonlyArray<{ key: LayerKey; icon: string; labelKey: string }> = [
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
}

/** Which quantity a layer's colour should follow (design rule 2). */
export const LAYER_TONE: Record<LayerKey, 'temp' | 'precip' | 'wind' | 'sun' | 'neutral'> = {
  temp: 'temp',
  precip: 'precip',
  wind: 'wind',
  sun: 'sun',
  humidity: 'neutral',
};

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

/** Deterministic values are preferred over ensemble percentiles where both exist:
 *  IFS is the sharper forecast, and the ensemble is there to express uncertainty. */
function dayHigh(d: Day): number | null {
  return num(d.hresTempMax) ?? ens(d, d.tempHi);
}
function dayLow(d: Day): number | null {
  return num(d.hresTempMin) ?? ens(d, d.tempLo);
}

export function layerRow(day: Day, layer: LayerKey, showSpread = true): LayerRow {
  const spread = <T extends Range>(r: T | null): Range | null =>
    showSpread && day.ensLoaded ? r : null;

  switch (layer) {
    case 'temp': {
      const lo = dayLow(day);
      const hi = dayHigh(day);
      return {
        primary: hi,
        secondary: lo,
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
      // The median is the honest headline: a mean is dragged upward by a few wet
      // members and would promise rain the ensemble does not agree on.
      const median = ens(day, day.precipMedian) ?? num(day.hresPrecip);
      const chance = ens(day, day.pChance);
      return {
        primary: median,
        secondary: null,
        band: median != null ? { lo: 0, hi: median } : null,
        spread: spread(
          ens(day, day.precipP10) != null && ens(day, day.precipP90) != null
            ? { lo: day.precipP10, hi: day.precipP90 }
            : null
        ),
        note: chance != null ? `${Math.round(chance)}%` : null,
      };
    }

    case 'wind': {
      const median = ens(day, day.windP50) ?? num(day.hresWindMax);
      return {
        primary: median,
        secondary: num(day.hresWindMax),
        band: median != null ? { lo: 0, hi: median } : null,
        spread: spread(
          ens(day, day.windP10) != null && ens(day, day.windP90) != null
            ? { lo: day.windP10, hi: day.windP90 }
            : null
        ),
        note: null,
      };
    }

    case 'sun': {
      const hours = num(day.sunHours);
      const et0 = num(day.et0);
      return {
        primary: hours,
        secondary: et0,
        band: hours != null ? { lo: 0, hi: hours } : null,
        // Sunshine comes from a deterministic run, not the ensemble, so there is no
        // spread to draw here however the preference is set.
        spread: null,
        note: null,
      };
    }

    case 'humidity': {
      const lo = ens(day, day.humidityP10) ?? num(day.hresRhMin) ?? num(day.harmRhMin);
      const hi = ens(day, day.humidityP90) ?? num(day.hresRhMax) ?? num(day.harmRhMax);
      const median = ens(day, day.humidityMedian) ?? (lo != null && hi != null ? (lo + hi) / 2 : null);
      return {
        primary: median,
        secondary: null,
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

  for (const d of days) {
    const row = layerRow(d, layer, showSpread);
    for (const r of [row.band, row.spread]) {
      if (!r) continue;
      if (Number.isFinite(r.lo)) lo = Math.min(lo, r.lo);
      if (Number.isFinite(r.hi)) hi = Math.max(hi, r.hi);
    }
  }

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
