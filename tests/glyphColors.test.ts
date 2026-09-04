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
  glyphLayerColors, glyphCloud, glyphRendering, wmoSymbol,
  GLYPH_CLOUD_LIGHT, GLYPH_CLOUD_DARK, GLYPH_SUN, GLYPH_PRECIP, GLYPH_STORM,
  GLYPH_MOON_LIGHT, GLYPH_MOON_DARK,
} from '../core/model/conditions';

const L = GLYPH_CLOUD_LIGHT;
const D = GLYPH_CLOUD_DARK;
const ML = GLYPH_MOON_LIGHT;
const MD = GLYPH_MOON_DARK;

/** code, day/night, and the layers expected on light and on dark. */
const AGREED: [number, boolean, string[], string[]][] = [
  // sun.max.fill — one layer, the same yellow in both.
  [0, true, [GLYPH_SUN], [GLYPH_SUN]],
  [1, true, [GLYPH_SUN], [GLYPH_SUN]],
  // moon.stars.fill and moon.fill — the moon and its stars are one pale night light.
  // It lifts on navy the way the cloud does.
  [0, false, [ML, ML], [MD, MD]],
  [1, false, [ML], [MD]],
  // cloud.sun.fill / cloud.moon.fill — the sun holds its yellow against either
  // ground; the moon is pale, and by night the whole glyph moves with the appearance.
  [2, true, [L, GLYPH_SUN], [D, GLYPH_SUN]],
  [2, false, [L, ML], [D, MD]],
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
  [80, false, [L, ML, GLYPH_PRECIP], [D, MD, GLYPH_PRECIP]],
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

  it('changes nothing but the cloud and the moon between appearances', () => {
    // The one rule that holds across the whole set, asserted over every code rather
    // than trusting the table above to be exhaustive.
    for (let code = 0; code <= 99; code++) {
      for (const isDay of [true, false]) {
        const light = glyphLayerColors(code, isDay, 'light');
        const dark = glyphLayerColors(code, isDay, 'dark');
        expect(dark, `code ${code}`).toEqual(
          light.map((c) =>
            c === GLYPH_CLOUD_LIGHT ? GLYPH_CLOUD_DARK
              : c === GLYPH_MOON_LIGHT ? GLYPH_MOON_DARK
              : c)
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

/**
 * How each glyph is handed to expo-symbols.
 *
 * The library drops a palette of one colour without applying anything
 * (`SymbolView.swift:138`), and with no tint set the symbol falls back to the system
 * default, which is blue. A single-layer glyph must therefore go out as a monochrome
 * tint. This is what made a clear night blue no matter which yellow was chosen, so
 * it is asserted per symbol rather than described.
 */
describe('glyphRendering', () => {
  /** Codes whose symbol has exactly one layer, and must never use palette. */
  const SINGLE: [number, boolean, string][] = [
    [0, true, GLYPH_SUN],   // sun.max.fill
    [1, true, GLYPH_SUN],   // sun.max.fill
    [1, false, GLYPH_MOON_LIGHT],  // moon.fill
    [3, true, GLYPH_CLOUD_LIGHT],  // cloud.fill
    [75, true, GLYPH_CLOUD_LIGHT], // snowflake
    [86, true, GLYPH_CLOUD_LIGHT], // snowflake
  ];

  for (const [code, isDay, expected] of SINGLE) {
    it(`tints ${wmoSymbol(code, isDay)} rather than sending a one-colour palette`, () => {
      const r = glyphRendering(code, isDay, 'light');
      expect(r.type).toBe('monochrome');
      expect(r.tintColor).toBe(expected);
      expect(r.colors).toBeUndefined();
    });
  }

  it('never emits a palette with fewer than two colours, for any code', () => {
    for (let code = 0; code <= 99; code++) {
      for (const isDay of [true, false]) {
        for (const appearance of ['light', 'dark'] as const) {
          const r = glyphRendering(code, isDay, appearance);
          if (r.type === 'palette') {
            expect(r.colors!.length, `code ${code}`).toBeGreaterThan(1);
            expect(r.tintColor, `code ${code}`).toBeUndefined();
          } else {
            expect(r.tintColor, `code ${code}`).toMatch(/^#[0-9A-F]{6}$/);
          }
        }
      }
    }
  });

  it('uses a palette where there is genuinely more than one layer', () => {
    const shower = glyphRendering(80, true, 'light');
    expect(shower.type).toBe('palette');
    expect(shower.colors).toEqual([GLYPH_CLOUD_LIGHT, GLYPH_SUN, GLYPH_PRECIP]);
  });

  it('lets a forced colour win outright', () => {
    const r = glyphRendering(80, true, 'dark', '#123456');
    expect(r).toEqual({ type: 'monochrome', tintColor: '#123456' });
  });
});
