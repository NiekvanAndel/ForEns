/**
 * The temperature scale: its anchors, and the floor every colour on it has to clear.
 *
 * The stop tables were derived once, by hand, from the design's scale — hue held,
 * lightness moved only where a stop could not be read. That derivation is not in the
 * code, so this is what stands in for it: walk the whole range in quarter degrees and
 * fail the moment a temperature would print below its floor. Darken a stop for looks
 * and this says so before a reader has to squint at it.
 */
import { describe, it, expect } from 'vitest';
import {
  TEMPERATURE_STOPS, TEMPERATURE_STOPS_DARK, TEMPERATURE_STOPS_LIGHT,
  temperatureColor,
} from '../core/model/temperatureColor';

/** The grounds a reading actually sits on: a white card over the cream page, a navy
 *  panel over the navy page. The lighter ground of each pair is the harder one. */
const WHITE = '#FFFFFF';
const NAVY_PANEL = '#0C2547';

/** Light matches the amber it replaces, which sat at 2.06:1 on a white card. Dark
 *  takes the large-text floor instead: the amber reaches 7.45:1 on navy, and holding
 *  the whole scale to that would wash every stop out to a pastel. */
const FLOOR = { light: 2.06, dark: 3.0 } as const;

const channel = (v: number): number => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

/** Hue in degrees, so a stop that moved can be shown to have moved only in lightness. */
const hue = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as
    [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0))
    : max === g ? (b - r) / d + 2
      : (r - g) / d + 4;
  return h * 60;
};

const everyQuarterDegree = (): number[] => {
  const out: number[] = [];
  for (let t = -30; t <= 50; t += 0.25) out.push(t);
  return out;
};

describe('temperatureColor', () => {
  it('lands exactly on a stop at the stop', () => {
    for (const stop of TEMPERATURE_STOPS_LIGHT) {
      expect(temperatureColor(stop.temp, 'light')?.toUpperCase()).toBe(stop.hex);
    }
    for (const stop of TEMPERATURE_STOPS_DARK) {
      expect(temperatureColor(stop.temp, 'dark')?.toUpperCase()).toBe(stop.hex);
    }
  });

  it('holds the end colours beyond the scale', () => {
    expect(temperatureColor(-40, 'light')?.toUpperCase()).toBe('#244E8C');
    expect(temperatureColor(60, 'light')?.toUpperCase()).toBe('#7A1414');
    expect(temperatureColor(-40, 'dark')?.toUpperCase()).toBe('#326DC4');
    expect(temperatureColor(60, 'dark')?.toUpperCase()).toBe('#D62323');
  });

  it('interpolates between two stops', () => {
    // Halfway from green (#5CB85C) to yellow (#D8C548) on dark.
    expect(temperatureColor(12.5, 'dark')?.toUpperCase()).toBe('#9ABF52');
  });

  it('has no colour for a missing reading', () => {
    expect(temperatureColor(null, 'light')).toBeNull();
    expect(temperatureColor(undefined, 'dark')).toBeNull();
    expect(temperatureColor(Number.NaN, 'light')).toBeNull();
  });

  it('keeps the design hue at every stop it moved', () => {
    const pairs = [
      ...TEMPERATURE_STOPS_LIGHT.map((s, i) => [s, TEMPERATURE_STOPS[i]] as const),
      ...TEMPERATURE_STOPS_DARK.map((s, i) => [s, TEMPERATURE_STOPS[i]] as const),
    ];
    for (const [moved, original] of pairs) {
      if (!original) continue;
      expect(Math.abs(hue(moved.hex) - hue(original.hex))).toBeLessThan(1);
    }
  });

  it('stays readable across the whole range, in both appearances', () => {
    for (const t of everyQuarterDegree()) {
      const onCard = temperatureColor(t, 'light');
      const onPanel = temperatureColor(t, 'dark');
      expect(contrast(onCard ?? WHITE, WHITE)).toBeGreaterThanOrEqual(FLOOR.light);
      expect(contrast(onPanel ?? NAVY_PANEL, NAVY_PANEL)).toBeGreaterThanOrEqual(FLOOR.dark);
    }
  });
});
