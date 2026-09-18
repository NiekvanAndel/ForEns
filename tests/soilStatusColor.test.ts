/**
 * The soil scale's colours.
 *
 * Two failures this pins, and the app shipped the first of them: two stops that are
 * the same colour, so the four-lamp shape reads as three lamps; and a stop that cannot
 * be read against the ground it is printed on.
 *
 * Neither is visible in a diff. `valSun` and `valTemp` are two names in the palette and
 * one colour in both appearances, which is why "suboptimaal" and "beregen nu" came out
 * identical for a while without anyone reading the code noticing.
 */
import { describe, it, expect } from 'vitest';
import {
  SOIL_FIELD_CAPACITY_INK, soilScale, soilStatusColor, type SoilAppearance,
} from '../core/model/soilStatusColor';

/** The ground each appearance prints on: the card, not the page behind it. */
const GROUND: Record<SoilAppearance, string> = { light: '#FFFFFF', dark: '#0C2547' };

/** Large text and graphical marks; the floor these figures are set at. */
const FLOOR = 3;

const channel = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255)
    + 0.7152 * channel((n >> 8) & 255)
    + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x!, y!) + 0.05) / (Math.min(x!, y!) + 0.05);
}

const APPEARANCES: SoilAppearance[] = ['light', 'dark'];

describe('the soil scale', () => {
  it.each(APPEARANCES)('has five stops that are all different in %s', (appearance) => {
    const stops = soilScale(appearance);
    expect(stops).toHaveLength(5);
    // The bug this exists for: two names in the palette, one colour on screen.
    expect(new Set(stops).size).toBe(5);
  });

  it.each(APPEARANCES)('keeps every stop readable in %s', (appearance) => {
    for (const stop of soilScale(appearance)) {
      expect(contrast(stop, GROUND[appearance])).toBeGreaterThanOrEqual(FLOOR);
    }
  });

  it.each(APPEARANCES)('runs wet to damaged, never backwards, in %s', (appearance) => {
    // Optimal is the green everywhere else in this app; critical is its red. A scale
    // that put the alarm colour anywhere but the top would be a scale nobody reads.
    expect(soilStatusColor(0, appearance)).toBe(soilScale(appearance)[1]);
    expect(soilStatusColor(3, appearance)).toBe(soilScale(appearance)[4]);
    expect(SOIL_FIELD_CAPACITY_INK[appearance]).toBe(soilScale(appearance)[0]);
  });

  it('has no colour at all for a state nobody knows', () => {
    // A field with no thresholds, or a sensor out of the ground. It must not borrow
    // the colour of a field that is fine.
    expect(soilStatusColor(null, 'light')).toBeNull();
    expect(soilStatusColor(undefined, 'dark')).toBeNull();
  });
});
