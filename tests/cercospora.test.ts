/**
 * Cercospora-DIV, and the leaf-wetness proxy.
 *
 * The table itself is unverified against IRS — see the warning in the module — so what
 * is pinned here are the properties that must hold *whatever* the numbers turn out to
 * be. If someone replaces the matrix with the primary source's, these tests are what
 * catch a transcription error in it.
 */
import { describe, it, expect } from 'vitest';
import {
  DIV_HUMIDITY, DIV_TABLE, cercospora, cercosporaAppliesTo, divFor,
} from '../core/model/cercospora';
import { LEAF_WET_HUMIDITY, leafWetHours, type HumidHour } from '../core/model/humidHours';

const pad = (n: number) => String(n).padStart(2, '0');

function day(
  date: string,
  opts: { humid?: [number, number]; temp?: number; missing?: number[] } = {}
): HumidHour[] {
  const { humid = [0, -1], temp = 20, missing = [] } = opts;
  const out: HumidHour[] = [];
  for (let h = 0; h < 24; h++) {
    if (missing.includes(h)) continue;
    const wet = h >= humid[0] && h <= humid[1];
    out.push({ time: `${date}T${pad(h)}:00`, humidity: wet ? 95 : 40, temp });
  }
  return out;
}

describe('the DIV table, whatever its numbers turn out to be', () => {
  it('never scores lower for more humid hours', () => {
    // The one property that cannot be wrong: a longer damp spell is never less
    // favourable than a shorter one at the same temperature. A transcription error in
    // the matrix shows up here first.
    for (const row of DIV_TABLE) {
      for (let i = 1; i < row.length; i++) {
        expect(row[i]!).toBeGreaterThanOrEqual(row[i - 1]!);
      }
    }
  });

  it('scores nothing at either temperature extreme', () => {
    // Too cold and too hot are both unsuitable, however damp it was. A table that
    // scored a hot damp day would warn every grower through a heatwave.
    expect(DIV_TABLE[0]!.every((v) => v === 0)).toBe(true);
    expect(DIV_TABLE[DIV_TABLE.length - 1]!.every((v) => v === 0)).toBe(true);
    expect(divFor(24, 10)).toBe(0);
    expect(divFor(24, 35)).toBe(0);
  });

  it('is a grid with a row per temperature band and a column per hour band', () => {
    expect(DIV_TABLE).toHaveLength(7);
    for (const row of DIV_TABLE) expect(row).toHaveLength(9);
  });

  it('scores a dry day zero and an unscoreable day null', () => {
    // Zero says the weather was unsuitable; null says nobody knows. A page that
    // showed the second as the first would be inventing a quiet day.
    expect(divFor(0, 20)).toBe(0);
    expect(divFor(12, null)).toBeNull();
  });
});

describe('DIV over a window', () => {
  it('scores each day and adds the last two', () => {
    const out = cercospora({
      hours: [
        ...day('2026-07-01', { humid: [0, 11], temp: 22 }),
        ...day('2026-07-02', { humid: [0, 11], temp: 22 }),
      ],
      source: 'canopy10cm',
    });
    expect(out.days).toHaveLength(2);
    expect(out.days.every((d) => (d.div ?? 0) > 0)).toBe(true);
    expect(out.recent).toBe((out.days[0]!.div ?? 0) + (out.days[1]!.div ?? 0));
    expect(out.source).toBe('canopy10cm');
  });

  it('leaves a half-reported day out of the totals', () => {
    // The same rule Smith follows: a day of nineteen hours cannot be compared against
    // a table counted in hours, and treating it as quiet clears a field on missing data.
    const out = cercospora({
      hours: day('2026-07-01', { humid: [0, 11], temp: 22, missing: [20, 21, 22, 23] }),
      source: 'canopy10cm',
    });
    expect(out.days[0]!.complete).toBe(false);
    expect(out.days[0]!.div).toBeNull();
    expect(out.total).toBe(0);
  });

  it('counts hours at ninety, because the model says ninety', () => {
    expect(DIV_HUMIDITY).toBe(90);
  });

  it('speaks for beet and for nothing else', () => {
    expect(cercosporaAppliesTo('Suikerbiet')).toBe(true);
    expect(cercosporaAppliesTo('biet')).toBe(true);
    expect(cercosporaAppliesTo('Aardappel')).toBe(false);
    expect(cercosporaAppliesTo(null)).toBe(false);
  });
});

describe('the leaf-wetness proxy', () => {
  const at = (h: number, humidity: number | null): HumidHour =>
    ({ time: `2026-07-01T${pad(h)}:00`, humidity, temp: 18 });

  it('counts hours above ninety-five, and says it is a proxy', () => {
    const out = leafWetHours([at(0, 96), at(1, 95), at(2, 99), at(3, null)]);
    // Above, not at: 95 itself does not count.
    expect(out.hours).toBe(2);
    // On the result, so nothing can print the figure without meeting the word.
    expect(out.proxy).toBe(true);
    expect(LEAF_WET_HUMIDITY).toBe(95);
  });

  it('does not count an hour nobody measured', () => {
    expect(leafWetHours([at(0, null), at(1, null)]).hours).toBe(0);
  });
});
