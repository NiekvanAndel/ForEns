/**
 * The humidity kernel, and Smith as its first client.
 *
 * Two kinds of mistake are pinned here, and the second is the dangerous one.
 *
 * A boundary read as "above" where the literature says "at or above" is invisible in a
 * dry week and shifts every period in a damp one. And a gap in the data treated as a
 * quiet hour turns a station outage into a clean bill of health — which is the failure
 * that matters, because stations drop readings in exactly the weather that produces
 * infection periods.
 */
import { describe, it, expect } from 'vitest';
import {
  humidDays, humidHoursFrom, humidRuns, type HumidHour,
} from '../core/model/humidHours';
import { SMITH, smith } from '../core/model/smith';

const pad = (n: number) => String(n).padStart(2, '0');

/** A full day of hours, with a window of them humid. */
function day(
  date: string,
  opts: { humid?: [number, number]; temp?: number; humidity?: number; missing?: number[] } = {}
): HumidHour[] {
  const { humid = [0, -1], temp = 15, humidity = 95, missing = [] } = opts;
  const out: HumidHour[] = [];
  for (let h = 0; h < 24; h++) {
    if (missing.includes(h)) continue;
    const wet = h >= humid[0] && h <= humid[1];
    out.push({ time: `${date}T${pad(h)}:00`, humidity: wet ? humidity : 40, temp });
  }
  return out;
}

describe('the humidity kernel', () => {
  it('counts a run at the threshold, not only above it', () => {
    // The published models say 90%, and 90 counts. Reading it as "above" moves every
    // period in a damp week.
    const hours: HumidHour[] = [
      { time: '2026-07-01T10:00', humidity: 90, temp: 14 },
      { time: '2026-07-01T11:00', humidity: 91, temp: 16 },
    ];
    const runs = humidRuns({ hours, minHumidity: 90 });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ hours: 2, from: '2026-07-01T10:00', to: '2026-07-01T11:00' });
    expect(runs[0]!.meanTemp).toBe(15);
    expect(runs[0]!.minTemp).toBe(14);
  });

  it('breaks a run on an hour nobody measured', () => {
    // An infection period claims the leaf stayed wet for eleven hours together. An
    // hour nobody measured cannot be counted toward that claim, and bridging it would
    // turn a sensor outage into a warning.
    const hours: HumidHour[] = [
      { time: '2026-07-01T10:00', humidity: 95, temp: 15 },
      { time: '2026-07-01T11:00', humidity: null, temp: 15 },
      { time: '2026-07-01T12:00', humidity: 95, temp: 15 },
    ];
    const runs = humidRuns({ hours, minHumidity: 90 });
    expect(runs.map((r) => r.hours)).toEqual([1, 1]);
  });

  it('lets a temperature floor break a run where a model has one', () => {
    const hours: HumidHour[] = [
      { time: '2026-07-01T10:00', humidity: 95, temp: 12 },
      { time: '2026-07-01T11:00', humidity: 95, temp: 8 },
      { time: '2026-07-01T12:00', humidity: 95, temp: 12 },
    ];
    expect(humidRuns({ hours, minHumidity: 90, minTemp: 10 }).map((r) => r.hours)).toEqual([1, 1]);
    // Without a floor the temperature only describes the run; it does not cut it.
    expect(humidRuns({ hours, minHumidity: 90 }).map((r) => r.hours)).toEqual([3]);
  });

  it('marks a day that is missing hours, rather than counting it short', () => {
    const short = humidDays(day('2026-07-01', { missing: [3, 4, 5] }), 90);
    expect(short[0]!.complete).toBe(false);
    expect(humidDays(day('2026-07-01'), 90)[0]!.complete).toBe(true);
  });
});

describe('Smith', () => {
  const wet = { humid: [0, 11] as [number, number], temp: 15 };

  it('needs two days in a row, each with eleven humid hours and a floor of ten', () => {
    expect(SMITH).toMatchObject({ humidity: 90, hoursPerDay: 11, minTemp: 10, days: 2 });

    const out = smith({
      hours: [...day('2026-07-01', wet), ...day('2026-07-02', wet)],
      source: 'standard150cm',
    });
    expect(out.days.every((d) => d.qualifies)).toBe(true);
    expect(out.periods).toHaveLength(1);
    expect(out.periods[0]).toMatchObject({ from: '2026-07-01', to: '2026-07-02', days: 2, complete: true });
    expect(out.active).toBe(true);
  });

  it('carries a single qualifying day without calling it a period', () => {
    // A grower watching one build wants to see the first day; it is simply not a
    // Smith period yet, and the app must not say it is.
    const out = smith({
      hours: [...day('2026-07-01', wet), ...day('2026-07-02', { humid: [0, 3], temp: 15 })],
      source: 'standard150cm',
    });
    expect(out.periods).toHaveLength(1);
    expect(out.periods[0]).toMatchObject({ days: 1, complete: false });
    expect(out.active).toBe(false);
  });

  it('holds a cold night below the floor, however damp it was', () => {
    const out = smith({
      hours: [
        ...day('2026-07-01', { ...wet, temp: 9 }),
        ...day('2026-07-02', { ...wet, temp: 9 }),
      ],
      source: 'standard150cm',
    });
    expect(out.days.every((d) => d.qualifies)).toBe(false);
    expect(out.periods).toHaveLength(0);
  });

  it('counts ten humid hours as ten, not as eleven', () => {
    const out = smith({
      hours: [...day('2026-07-01', { humid: [0, 9], temp: 15 })],
      source: 'standard150cm',
    });
    expect(out.days[0]!.humidHours).toBe(10);
    expect(out.days[0]!.qualifies).toBe(false);
  });

  it('will not build a period across a day it never saw', () => {
    // Two qualifying days either side of a missing one are not two days in a row.
    const out = smith({
      hours: [...day('2026-07-01', wet), ...day('2026-07-03', wet)],
      source: 'standard150cm',
    });
    expect(out.periods.map((p) => p.days)).toEqual([1, 1]);
    expect(out.periods.every((p) => !p.complete)).toBe(true);
  });

  it('refuses to qualify a half-reported day, and says why', () => {
    // Eleven humid hours out of nineteen answers a different question. And the day
    // must not read as quiet: the station was down, which is not the same as dry.
    const out = smith({
      hours: [...day('2026-07-01', { humid: [0, 12], temp: 15, missing: [20, 21, 22, 23] })],
      source: 'standard150cm',
    });
    expect(out.days[0]!.humidHours).toBeGreaterThanOrEqual(SMITH.hoursPerDay);
    expect(out.days[0]!.complete).toBe(false);
    expect(out.days[0]!.qualifies).toBe(false);
  });

  it('carries the height the humidity was measured at', () => {
    // A period found at 10 cm is a different claim from one found at 1,50 m, and the
    // page has to be able to say which it is showing.
    expect(smith({ hours: day('2026-07-01', wet), source: 'canopy10cm' }).source)
      .toBe('canopy10cm');
  });
});

describe('which height the models run on', () => {
  const at = (time: string, humidity: number | null): HumidHour =>
    ({ time, humidity, temp: 15 });

  it('prefers the crop sensor where one reports', () => {
    // Air inside a canopy is damper and stays damp for hours longer after dawn, which
    // is exactly the stretch an infection model counts.
    const out = humidHoursFrom(
      [at('2026-07-01T06:00', 78)],
      [at('2026-07-01T06:00', 96)]
    );
    expect(out.source).toBe('canopy10cm');
    expect(out.hours[0]!.humidity).toBe(96);
  });

  it('falls back where the crop sensor is silent, and says so', () => {
    // A PRO whose probe is out must not produce a week of empty hours — and the result
    // has to name what was actually used, not what was hoped for.
    const out = humidHoursFrom(
      [at('2026-07-01T06:00', 78)],
      [at('2026-07-01T06:00', null)]
    );
    expect(out.source).toBe('standard150cm');
    expect(out.hours[0]!.humidity).toBe(78);
  });

  it('never mixes the two', () => {
    // Two numbers answering one question is what the honesty rules forbid.
    const out = humidHoursFrom(
      [at('2026-07-01T06:00', 78), at('2026-07-01T07:00', 80)],
      [at('2026-07-01T06:00', 96)]
    );
    expect(out.hours).toHaveLength(1);
  });
});
