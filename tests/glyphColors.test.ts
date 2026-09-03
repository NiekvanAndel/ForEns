/**
 * The agreed colour of every weather glyph, layer by layer.
 *
 * This set was settled by hand against a rendered reference after several rounds of
 * it being got wrong, so it is written out here in full rather than derived — a
 * table you can read against the design, not a restatement of the implementation.
 * If a constant moves, this says exactly which glyphs move with it.
 */
import { describe, it, expect } from 'vitest';
import {
  glyphLayerColors, glyphCloud, wmoSymbol,
  GLYPH_CLOUD_LIGHT, GLYPH_CLOUD_DARK, GLYPH_SUN, GLYPH_PRECIP, GLYPH_STORM,
} from '../core/model/conditions';

const L = GLYPH_CLOUD_LIGHT;
const D = GLYPH_CLOUD_DARK;

/** code, day/night, and the layers expected on light and on dark. */
const AGREED: [number, boolean, string[], string[]][] = [
  // sun.max.fill — one layer, the same yellow in both.
  [0, true, [GLYPH_SUN], [GLYPH_SUN]],
  [1, true, [GLYPH_SUN], [GLYPH_SUN]],
  // moon.stars.fill and moon.fill — the moon is the same light as the sun.
  [0, false, [GLYPH_SUN, GLYPH_SUN], [GLYPH_SUN, GLYPH_SUN]],
  [1, false, [GLYPH_SUN], [GLYPH_SUN]],
  // cloud.sun.fill / cloud.moon.fill — only the cloud moves between appearances.
  [2, true, [L, GLYPH_SUN], [D, GLYPH_SUN]],
  [2, false, [L, GLYPH_SUN], [D, GLYPH_SUN]],
  // cloud.fill — one layer, the cloud alone.
  [3, true, [L], [D]],
  // cloud.fog.fill — the fog lines read as part of the cloud, so they share its tone.
  [45, true, [L, L], [D, D]],
  [48, true, [L, L], [D, D]],
  // Drizzle, rain, sleet, heavy rain — cloud plus one precipitation layer.
  [51, true, [L, GLYPH_PRECIP], [D, GLYPH_PRECIP]],
  [53, true, [L, GLYPH_PRECIP], [D, GLYPH_PRECIP]],
  [55, true, [L, GLYPH_PRECIP], [D, GLYPH_PRECIP]],
  [56, true, [L, GLYPH_PRECIP], [D, GLYPH_PRECIP]],
  [61, true, [L, GLYPH_PRECIP], [D, GLYPH_PRECIP]],
  [63, true, [L, GLYPH_PRECIP], [D, GLYPH_PRECIP]],
  [65, true, [L, GLYPH_PRECIP], [D, GLYPH_PRECIP]],
  [66, true, [L, GLYPH_PRECIP], [D, GLYPH_PRECIP]],
  [82, true, [L, GLYPH_PRECIP], [D, GLYPH_PRECIP]],
  // Snow — the flakes take the cloud's tone, so the glyph reads as one object.
  [71, true, [L, L], [D, D]],
  [73, true, [L, L], [D, D]],
  [77, true, [L, L], [D, D]],
  [85, true, [L, L], [D, D]],
  // snowflake on its own — one layer, the cloud tone again.
  [75, true, [L], [D]],
  [86, true, [L], [D]],
  // Showers keep their luminary: cloud, sun or moon, rain.
  [80, true, [L, GLYPH_SUN, GLYPH_PRECIP], [D, GLYPH_SUN, GLYPH_PRECIP]],
  [80, false, [L, GLYPH_SUN, GLYPH_PRECIP], [D, GLYPH_SUN, GLYPH_PRECIP]],
  [81, true, [L, GLYPH_SUN, GLYPH_PRECIP], [D, GLYPH_SUN, GLYPH_PRECIP]],
  // Thunderstorms: cloud, bolt, rain — and code 99 has no rain layer.
  [95, true, [L, GLYPH_STORM, GLYPH_PRECIP], [D, GLYPH_STORM, GLYPH_PRECIP]],
  [96, true, [L, GLYPH_STORM, GLYPH_PRECIP], [D, GLYPH_STORM, GLYPH_PRECIP]],
  [99, true, [L, GLYPH_STORM], [D, GLYPH_STORM]],
];

describe('glyphLayerColors', () => {
  for (const [code, isDay, light, dark] of AGREED) {
    const label = `${wmoSymbol(code, isDay)} (${code}, ${isDay ? 'day' : 'night'})`;
    it(`draws ${label}`, () => {
      expect(glyphLayerColors(code, isDay, 'light')).toEqual(light);
      expect(glyphLayerColors(code, isDay, 'dark')).toEqual(dark);
    });
  }

  it('changes nothing but the cloud between appearances', () => {
    // The one rule that holds across the whole set, asserted over every code rather
    // than trusting the table above to be exhaustive.
    for (let code = 0; code <= 99; code++) {
      for (const isDay of [true, false]) {
        const light = glyphLayerColors(code, isDay, 'light');
        const dark = glyphLayerColors(code, isDay, 'dark');
        expect(dark, `code ${code}`).toEqual(
          light.map((c) => (c === GLYPH_CLOUD_LIGHT ? GLYPH_CLOUD_DARK : c))
        );
      }
    }
  });

  it('never leaves a layer without a colour', () => {
    for (let code = 0; code <= 99; code++) {
      for (const isDay of [true, false]) {
        for (const colors of [glyphLayerColors(code, isDay, 'light'), glyphLayerColors(code, isDay, 'dark')]) {
          for (const c of colors) expect(c, `code ${code}`).toMatch(/^#[0-9A-F]{6}$/);
        }
      }
    }
  });

  it('has a cloud tone for a glyph with no readable layers', () => {
    expect(glyphCloud('light')).toBe(GLYPH_CLOUD_LIGHT);
    expect(glyphCloud('dark')).toBe(GLYPH_CLOUD_DARK);
  });
});
