/**
 * Every disease model that applies at one location.
 *
 * The thing pinned hardest is that this is the *only* path: three surfaces read it, and
 * the rainfall bug taught that a second path answering the same question drifts from
 * the first within a week.
 */
import { describe, it, expect } from 'vitest';
import { diseasePressure } from '../core/model/diseasePressure';
import type { HumidHour } from '../core/model/humidHours';

const pad = (n: number) => String(n).padStart(2, '0');

function day(date: string, humidUntil: number, temp = 22): HumidHour[] {
  return Array.from({ length: 24 }, (_, h) => ({
    time: `${date}T${pad(h)}:00`,
    humidity: h <= humidUntil ? 96 : 40,
    temp,
  }));
}

const wetWeek = [...day('2026-07-01', 11), ...day('2026-07-02', 11)];

describe('disease pressure', () => {
  it('runs a model per crop, so one pole can carry two', () => {
    // A weather station stands over a yard where several things grow. Potato and beet
    // under one pole are two badges, not a choice.
    const out = diseasePressure({
      hours: wetWeek,
      crops: ['Aardappel', 'Suikerbiet'],
      source: 'standard150cm',
    });
    expect(out.readings.map((r) => r.model)).toEqual(['smith', 'div']);
    expect(out.readings.map((r) => r.crop)).toEqual(['Aardappel', 'Suikerbiet']);
  });

  it('runs only what the crop calls for', () => {
    const potato = diseasePressure({
      hours: wetWeek, crops: ['Aardappel'], source: 'canopy10cm',
    });
    expect(potato.readings.map((r) => r.model)).toEqual(['smith']);

    // Onions have neither model yet, so there is nothing to show and no card.
    expect(diseasePressure({ hours: wetWeek, crops: ['Ui'], source: 'canopy10cm' }).readings)
      .toEqual([]);
  });

  it('takes the worst reading as the location’s own', () => {
    const out = diseasePressure({
      hours: wetWeek, crops: ['Aardappel', 'Suikerbiet'], source: 'standard150cm',
    });
    expect(out.level).toBe(Math.max(...out.readings.map((r) => r.level)));
    expect(out.level).toBe(2);
  });

  it('carries the figure the model is actually read on', () => {
    const out = diseasePressure({
      hours: wetWeek, crops: ['Aardappel', 'Suikerbiet'], source: 'standard150cm',
    });
    const smith = out.readings.find((r) => r.model === 'smith')!;
    const div = out.readings.find((r) => r.model === 'div')!;
    // Days toward a period, and the two-day DIV total. A grower who knows the model
    // wants the number; one who does not is no better served by a word.
    expect(smith).toMatchObject({ value: 2, limit: 2, level: 2 });
    expect(div.limit).toBe(6);
  });

  it('says nothing at all when nothing was measured', () => {
    // Not "no infection period" — nobody looked. The card does not appear.
    const out = diseasePressure({ hours: [], crops: ['Aardappel'], source: 'canopy10cm' });
    expect(out.readings).toEqual([]);
    expect(out.level).toBe(0);
    expect(out.leafWet).toBeNull();
  });

  it('offers the leaf-wetness proxy only under a model that needs it', () => {
    const under = diseasePressure({
      hours: wetWeek, crops: ['Aardappel'], source: 'canopy10cm',
    });
    expect(under.leafWet).toMatchObject({ proxy: true });
    // And not on a crop with no model: a proxy with nothing to support is a number
    // on a page for its own sake.
    expect(diseasePressure({ hours: wetWeek, crops: ['Ui'], source: 'canopy10cm' }).leafWet)
      .toBeNull();
  });
});
