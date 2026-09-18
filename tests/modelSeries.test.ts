/**
 * The disease models over a period.
 *
 * The failure to design against is the same one the models themselves guard: a day the
 * instrument only half reported must be a gap, never a low bar. A bar of four on a day
 * the station was down reads as a quiet day, and quiet days are exactly what a grower
 * decides not to walk the field on.
 */
import { describe, it, expect } from 'vitest';
import { MODEL_SERIES_META, buildModelSeries } from '../core/model/modelSeries';
import { SMITH } from '../core/model/smith';
import { DIV_RECENT_THRESHOLD } from '../core/model/cercospora';
import type { HumidHour } from '../core/model/humidHours';

const pad = (n: number) => String(n).padStart(2, '0');

function day(
  date: string,
  opts: { humidUntil?: number; temp?: number; missing?: number[] } = {}
): HumidHour[] {
  const { humidUntil = -1, temp = 22, missing = [] } = opts;
  const out: HumidHour[] = [];
  for (let h = 0; h < 24; h++) {
    if (missing.includes(h)) continue;
    out.push({ time: `${date}T${pad(h)}:00`, humidity: h <= humidUntil ? 96 : 40, temp });
  }
  return out;
}

describe('Smith over a period', () => {
  it('counts the humid hours of each day against eleven', () => {
    const out = buildModelSeries({
      key: 'smithHours', from: '2026-07-01', to: '2026-07-02',
      hours: [...day('2026-07-01', { humidUntil: 11 }), ...day('2026-07-02', { humidUntil: 3 })],
    });
    expect(out.resolution).toBe('day');
    expect(out.samples.map((s) => s.value)).toEqual([12, 4]);
    expect(MODEL_SERIES_META.smithHours.threshold).toBe(SMITH.hoursPerDay);
  });

  it('pins the axis to a whole day, so eleven means eleven out of twenty-four', () => {
    // An axis fitted to a quiet week would put the line above the plot on one week and
    // make a bar of four look alarming on the next.
    expect(MODEL_SERIES_META.smithHours).toMatchObject({
      axisMin: 0, axisMax: 24, axisFixed: true,
    });
  });
});

describe('DIV over a period', () => {
  it('scores each day and runs the two-day total over it', () => {
    const out = buildModelSeries({
      key: 'divDaily', from: '2026-07-01', to: '2026-07-02',
      hours: [...day('2026-07-01', { humidUntil: 11 }), ...day('2026-07-02', { humidUntil: 11 })],
    });
    const [first, second] = out.samples;
    expect(first!.value).toBeGreaterThan(0);
    // The line is the figure the guidance is read on: two fives make a ten.
    expect(second!.cumulative).toBe((first!.value ?? 0) + (second!.value ?? 0));
    expect(MODEL_SERIES_META.divDaily.threshold).toBe(DIV_RECENT_THRESHOLD);
  });

  it('will not span a gap with its running total', () => {
    // Two scored days either side of a day nobody measured are not two days in a row.
    const out = buildModelSeries({
      key: 'divDaily', from: '2026-07-01', to: '2026-07-03',
      hours: [
        ...day('2026-07-01', { humidUntil: 11 }),
        ...day('2026-07-02', { humidUntil: 11, missing: [0, 1, 2, 3] }),
        ...day('2026-07-03', { humidUntil: 11 }),
      ],
    });
    expect(out.samples[1]!.value).toBeNull();
    expect(out.samples[1]!.cumulative).toBeNull();
    // The day after a gap stands alone rather than borrowing across it.
    expect(out.samples[2]!.cumulative).toBe(out.samples[2]!.value);
  });
});

describe('days nobody measured', () => {
  it('leaves a gap rather than a low bar', () => {
    const out = buildModelSeries({
      key: 'smithHours', from: '2026-07-01', to: '2026-07-01',
      hours: day('2026-07-01', { humidUntil: 11, missing: [20, 21, 22, 23] }),
    });
    expect(out.samples[0]!.value).toBeNull();
  });

  it('draws a day the window covers even where nothing came back for it', () => {
    // A week with a silent Tuesday shows a gap on Tuesday, not six days.
    const out = buildModelSeries({
      key: 'smithHours', from: '2026-07-01', to: '2026-07-03',
      hours: day('2026-07-01', { humidUntil: 11 }),
    });
    expect(out.samples.map((s) => s.key)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(out.samples.slice(1).every((s) => s.value == null)).toBe(true);
  });

  it('claims no forecast, and claims nothing measured', () => {
    // These are conclusions drawn from measurements — the third kind of value — so the
    // green dot stays off and the line is never dashed.
    const out = buildModelSeries({
      key: 'smithHours', from: '2026-07-01', to: '2026-07-01',
      hours: day('2026-07-01', { humidUntil: 11 }),
    });
    expect(out.forecastFrom).toBe(-1);
    expect(out.anyMeasured).toBe(false);
  });
});
