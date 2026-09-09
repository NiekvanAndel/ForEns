/**
 * Unit conversion and formatting.
 *
 * Ported from index.html (`fmtTemp`, `fmtTempShort`, `tempUnit`, `convTempVal`,
 * `convWindVal`, `fmtWind`, `windUnit`, `fmtPres`). The web app read the chosen
 * units from the `PREFS` global; here each function takes the unit explicitly, so
 * a widget rendering in the background cannot pick up the wrong one.
 *
 * Inputs are always the canonical units the APIs return: °C, km/h and hPa.
 */

export type TempUnit = 'C' | 'F' | 'K';
export type WindUnit = 'kmh' | 'ms' | 'kn' | 'bft';
export type PresUnit = 'hPa' | 'mbar' | 'inHg';

const DASH = '—';

/** Beaufort lower bounds in km/h, force 0 through 12. */
const BEAUFORT = [0, 1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];

/** Beaufort force for a km/h wind speed. */
export function toBeaufort(kmh: number): number {
  const b = BEAUFORT.findIndex((t) => kmh < t) - 1;
  return b < 0 ? 12 : Math.max(0, b);
}

/** Temperature with its unit, e.g. "18°C". */
export function fmtTemp(c: number | null | undefined, unit: TempUnit): string {
  if (c == null) return DASH;
  const v = Number(c);
  if (unit === 'F') return Math.round((v * 9) / 5 + 32) + '°F';
  if (unit === 'K') return Math.round(v + 273.15) + ' K';
  return Math.round(v) + '°C';
}

/** Temperature without a unit letter, for dense rows: "18°" (or "291" in kelvin). */
export function fmtTempShort(c: number | null | undefined, unit: TempUnit): string {
  if (c == null) return DASH;
  const v = Number(c);
  if (unit === 'F') return Math.round((v * 9) / 5 + 32) + '°';
  if (unit === 'K') return String(Math.round(v + 273.15));
  return Math.round(v) + '°';
}

export function tempUnitLabel(unit: TempUnit): string {
  if (unit === 'F') return '°F';
  if (unit === 'K') return 'K';
  return '°C';
}

/** Numeric conversion without a label, for chart axes. */
export function convTemp(c: number | null | undefined, unit: TempUnit): number | null {
  if (c == null) return null;
  const v = Number(c);
  if (unit === 'F') return Math.round((v * 9) / 5 + 32);
  if (unit === 'K') return Math.round(v + 273.15);
  return Math.round(v);
}

/**
 * A wind bearing as the heading it blows toward.
 *
 * `winddirection_10m` is meteorological: the direction the wind comes *from*, so 0°
 * is a northerly and a northerly blows south. An arrow shows where the air is going,
 * which is the half turn — the same `(d + 180) % 360` index.html applies everywhere
 * it draws one.
 */
export function windHeading(deg: number): number {
  return ((deg % 360) + 540) % 360;
}

/** Numeric wind conversion without a label. In Beaufort this is the force, not a speed. */
export function convWind(kmh: number | null | undefined, unit: WindUnit): number | null {
  if (kmh == null) return null;
  const v = Number(kmh);
  if (unit === 'ms') return Math.round(v / 3.6);
  if (unit === 'kn') return Math.round(v * 0.54);
  if (unit === 'bft') return toBeaufort(v);
  return Math.round(v);
}

export function fmtWind(kmh: number | null | undefined, unit: WindUnit): string {
  if (kmh == null) return DASH;
  const v = Number(kmh);
  if (unit === 'ms') return Math.round(v / 3.6) + ' m/s';
  if (unit === 'kn') return Math.round(v * 0.54) + ' kn';
  if (unit === 'bft') return 'Bft ' + toBeaufort(v);
  return Math.round(v) + ' km/u';
}

export function windUnitLabel(unit: WindUnit): string {
  if (unit === 'ms') return 'm/s';
  if (unit === 'kn') return 'kn';
  if (unit === 'bft') return 'Bft';
  return 'km/u';
}

/**
 * A reading with one decimal, but only where the reading has one.
 *
 * The stations report tenths and the models often do too, and rounding a measured
 * 17,3 °C to 18 throws away the precision the instrument was bought for. But a feed
 * that reports whole degrees should not be dressed up as tenths either, so a value
 * that is whole to within a tenth prints as a whole number: "17,3" and "17", never
 * "17,0".
 *
 * The comma is the decimal separator, per the design system's Dutch number rules.
 *
 * `convTemp` and `convWind` above stay as they are. They are a port of index.html's
 * own conversions and the parity suite pins them to it; this is a second, finer
 * rendering for the places that have the room for it, not a replacement.
 */
export function fmtDecimal(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return DASH;
  const tenths = Math.round(Number(v) * 10) / 10;
  const whole = Math.round(tenths);
  // A tenth of nothing is nothing: print the integer rather than a trailing ",0".
  if (Math.abs(tenths - whole) < 0.05) return String(whole === 0 ? 0 : whole);
  return tenths.toFixed(1).replace('.', ',');
}

/** Temperature converted but not rounded, so `fmtDecimal` can keep its tenths. */
export function convTempExact(c: number | null | undefined, unit: TempUnit): number | null {
  if (c == null) return null;
  const v = Number(c);
  if (unit === 'F') return (v * 9) / 5 + 32;
  if (unit === 'K') return v + 273.15;
  return v;
}

/** Wind converted but not rounded. Beaufort is a force, not a speed, so it stays a
 *  whole number however fine the reading behind it was. */
export function convWindExact(kmh: number | null | undefined, unit: WindUnit): number | null {
  if (kmh == null) return null;
  const v = Number(kmh);
  if (unit === 'ms') return v / 3.6;
  if (unit === 'kn') return v * 0.54;
  if (unit === 'bft') return toBeaufort(v);
  return v;
}

/** Temperature for a reading with room for its tenths: "17,3", "17", "—". */
export function fmtTempValue(c: number | null | undefined, unit: TempUnit): string {
  return fmtDecimal(convTempExact(c, unit));
}

/** Wind for the same, in the chosen unit. */
export function fmtWindValue(kmh: number | null | undefined, unit: WindUnit): string {
  return fmtDecimal(convWindExact(kmh, unit));
}

export function fmtPressure(hpa: number | null | undefined, unit: PresUnit): string {
  if (hpa == null) return DASH;
  const v = Number(hpa);
  if (unit === 'mbar') return Math.round(v) + ' mbar';
  if (unit === 'inHg') return (v * 0.02953).toFixed(2) + ' inHg';
  return Math.round(v) + ' hPa';
}

/** Millimetres with a comma decimal, per the design system's Dutch number rules. */
export function fmtMm(mm: number | null | undefined, decimals = 1): string {
  if (mm == null) return DASH;
  return mm.toFixed(decimals).replace('.', ',');
}

const COMPASS = [
  'N', 'NNO', 'NO', 'ONO', 'O', 'OZO', 'ZO', 'ZZO',
  'Z', 'ZZW', 'ZW', 'WZW', 'W', 'WNW', 'NW', 'NNW',
];

/** Dutch compass point for a bearing in degrees. */
export function degToCompass(d: number | null | undefined): string {
  if (d == null) return DASH;
  return COMPASS[Math.round(d / 22.5) % 16] as string;
}

/** Text-size scale factors, matching the web app's `applyFontSize`. */
export const FONT_SCALE = { sm: 0.85, md: 1, lg: 1.2 } as const;
export type FontSizePref = keyof typeof FONT_SCALE;
