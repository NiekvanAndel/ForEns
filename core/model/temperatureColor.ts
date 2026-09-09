/**
 * The temperature scale: what colour a temperature is.
 *
 * A single amber said "this is a temperature". A scale says how warm it is, so the
 * number and its colour carry the same fact and a column of hours reads as weather
 * rather than as a list. The anchor stops come from the design system's scale, in
 * Celsius, and anything between two of them is interpolated straight through RGB.
 *
 * Always fed the Celsius value, never the reader's own unit: the same weather has to
 * be the same colour whether it is printed in °C, °F or K. Below -20 and above 40 the
 * end colours hold — the scale runs out, the weather does not.
 *
 * Two tables, because a colour has to be readable and legibility is what changes
 * between appearances, exactly as `glyphCloud` and the palette's reading inks do.
 * Both keep the design's hue to a tenth of a degree; only lightness moves, and only
 * where a stop could not be read:
 *
 *   - Light: mint (0°) and yellow (15°) were the palest against a white card, so they
 *     drop until they match the amber they replace — 2.06:1 on white, which is where
 *     that amber already sat. The other seven are untouched.
 *   - Dark: dark blue (-20°) and dark red (40°) all but vanished into navy, so they
 *     lift to 3:1, the large-text floor. Blue (-10°) lifts a shade with them so the
 *     stretch between them does not dip below it. The other six are untouched.
 *
 * `tests/temperatureColor.test.ts` walks the whole range in both appearances and
 * fails if any temperature falls under its floor, so a future edit to a stop cannot
 * quietly make a number unreadable.
 */

export type TemperatureAppearance = 'light' | 'dark';

export interface TemperatureStop {
  /** Degrees Celsius. */
  temp: number;
  hex: string;
}

/** The design's scale as delivered, unadjusted. The two tables below are this one
 *  with individual stops darkened or lifted; keeping it means a reader can see at a
 *  glance which stops moved and by how much. */
export const TEMPERATURE_STOPS: readonly TemperatureStop[] = [
  { temp: -20, hex: '#244E8C' }, // dark blue
  { temp: -10, hex: '#3A70B0' }, // blue
  { temp: 0, hex: '#7FD9C9' },   // light blue / mint green
  { temp: 10, hex: '#5CB85C' },  // green
  { temp: 15, hex: '#D8C548' },  // yellow
  { temp: 20, hex: '#F2A134' },  // orange
  { temp: 25, hex: '#EA7F2E' },  // deep orange
  { temp: 30, hex: '#E0483F' },  // red
  { temp: 40, hex: '#7A1414' },  // dark red
];

export const TEMPERATURE_STOPS_LIGHT: readonly TemperatureStop[] = [
  { temp: -20, hex: '#244E8C' },
  { temp: -10, hex: '#3A70B0' },
  { temp: 0, hex: '#47C8B2' },   // mint, darkened
  { temp: 10, hex: '#5CB85C' },
  { temp: 15, hex: '#CBB52B' },  // yellow, darkened
  { temp: 20, hex: '#F2A134' },
  { temp: 25, hex: '#EA7F2E' },
  { temp: 30, hex: '#E0483F' },
  { temp: 40, hex: '#7A1414' },
];

export const TEMPERATURE_STOPS_DARK: readonly TemperatureStop[] = [
  { temp: -20, hex: '#326DC4' }, // dark blue, lifted
  { temp: -10, hex: '#3D76B9' }, // blue, lifted a shade
  { temp: 0, hex: '#7FD9C9' },
  { temp: 10, hex: '#5CB85C' },
  { temp: 15, hex: '#D8C548' },
  { temp: 20, hex: '#F2A134' },
  { temp: 25, hex: '#EA7F2E' },
  { temp: 30, hex: '#E0483F' },
  { temp: 40, hex: '#D62323' },  // dark red, lifted
];

export function temperatureStops(
  appearance: TemperatureAppearance
): readonly TemperatureStop[] {
  return appearance === 'dark' ? TEMPERATURE_STOPS_DARK : TEMPERATURE_STOPS_LIGHT;
}

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const rgbToHex = (rgb: readonly number[]): string =>
  `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

const mix = (a: string, b: string, t: number): string => {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  return rgbToHex(from.map((v, i) => v + ((to[i] ?? v) - v) * t));
};

/**
 * The scale's colour for a temperature in Celsius, or null where there is none —
 * a block with no reading prints a dash, and a dash is not a temperature.
 */
export function temperatureColor(
  celsius: number | null | undefined,
  appearance: TemperatureAppearance
): string | null {
  if (celsius == null || !Number.isFinite(celsius)) return null;

  const stops = temperatureStops(appearance);
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return null;
  if (celsius <= first.temp) return first.hex;
  if (celsius >= last.temp) return last.hex;

  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = stops[i];
    const b = stops[i + 1];
    if (!a || !b) break;
    if (celsius >= a.temp && celsius <= b.temp) {
      return mix(a.hex, b.hex, (celsius - a.temp) / (b.temp - a.temp));
    }
  }
  return last.hex;
}
