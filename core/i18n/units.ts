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
