/**
 * Soil quantities on 'Grafiek'.
 *
 * The risky parts are the ones where a chart can look right and be wrong: a gap the
 * grid quietly fills, a pill for a probe that is not there, and pF on an axis that
 * scales to its data.
 */
import { describe, it, expect } from 'vitest';
import {
  SOIL_SERIES_META, buildSoilSeries, refillSeriesBars, soilSeriesKeys, soilTensionAxis,
} from '../core/model/soilSeries';
import { FIELD_CAPACITY_KPA, kPaToPf } from '../core/model/soil';
import type { SoilSample } from '../core/sources/agroexact';

function s(time: string, over: Partial<SoilSample> = {}): SoilSample {
  return {
    time, measTime: `${time}:00Z`,
    tension: 40, status: 1, pF: 2.3, waterPercent: 24,
    refillMm: 20, refillToScarceMm: 8, soilTemp: 16,
    temp10: null, humidity10: null, dewpoint10: null,
    leafWetProxy: null, precip: null,
    ...over,
  };
}

describe('soil series', () => {
  it('lays the readings on the window grid, oldest first', () => {
    const out = buildSoilSeries({
      key: 'waterTension', from: '2026-07-01', to: '2026-07-01',
      samples: [s('2026-07-01T09:00', { tension: 41 }), s('2026-07-01T10:00', { tension: 44 })],
    });
    expect(out.samples).toHaveLength(24);
    expect(out.samples[9]).toMatchObject({ key: '2026-07-01T09:00', value: 41, measured: true });
    expect(out.samples[10]!.value).toBe(44);
  });

  it('leaves a gap as a gap rather than carrying the last value forward', () => {
    // A bridged gap is a chart saying the field was measured when it was not.
    const out = buildSoilSeries({
      key: 'waterTension', from: '2026-07-01', to: '2026-07-01',
      samples: [s('2026-07-01T09:00'), s('2026-07-01T12:00')],
    });
    expect(out.samples[10]!.value).toBeNull();
    expect(out.samples[10]!.measured).toBe(false);
  });

  it('never claims a future, because there is no soil forecast to claim one from', () => {
    const out = buildSoilSeries({
      key: 'waterTension', from: '2026-07-01', to: '2026-07-01',
      samples: [s('2026-07-01T09:00')],
    });
    expect(out.forecastFrom).toBe(-1);
    expect(out.samples.every((x) => x.future === false)).toBe(true);
  });

  it('folds a long window into days, keeping each day range as a band', () => {
    const samples = [
      s('2026-07-01T09:00', { tension: 20 }), s('2026-07-01T15:00', { tension: 40 }),
      s('2026-07-05T09:00', { tension: 55 }),
    ];
    const out = buildSoilSeries({
      key: 'waterTension', from: '2026-07-01', to: '2026-07-05', samples,
    });
    expect(out.resolution).toBe('day');
    const first = out.samples[0]!;
    // A day that ran from 20 to 40 and a day that sat at 30 are the same line and very
    // different days.
    expect(first).toMatchObject({ key: '2026-07-01', value: 30 });
    expect(first.band).toEqual({ lo: 20, hi: 40 });
  });

  it('offers the canopy pills only on the model that has that probe', () => {
    // BASIC is suction only, PLUS adds rainfall, PRO adds the air at 10 cm. Hardware,
    // so no window of readings can change the answer.
    const reading = s('2026-07-01T09:00', { temp10: 19, humidity10: 88 });
    expect(soilSeriesKeys('PRO', [reading])).toContain('temp10');
    expect(soilSeriesKeys('BASIC', [reading])).not.toContain('temp10');
    expect(soilSeriesKeys('PLUS', [reading])).not.toContain('humidity10');
    // An unknown model answers conservatively: suction is all every sensor has.
    expect(soilSeriesKeys(null, [reading])).not.toContain('temp10');
    expect(soilSeriesKeys(null, [reading])).toContain('waterTension');
  });

  it('still drops a pill for a probe that said nothing all window', () => {
    // The model says the probe is there; the window says it reported nothing. A pill
    // onto an empty chart leaves the reader wondering what they did wrong.
    expect(soilSeriesKeys('PRO', [s('2026-07-01T09:00')])).not.toContain('temp10');
  });

  it('pins pF from field capacity upward instead of letting it scale', () => {
    // Two is field capacity: 10 kPa is pF 2.008, so the axis starts where the soil
    // stops draining and starts drying. Below it the reading says "wetter than the
    // crop needs", which is one state and does not want two thirds of a chart.
    // Logarithmic and self-scaling together turn a wet week into one straight line.
    expect(SOIL_SERIES_META.pF).toMatchObject({ axisMin: 2, axisMax: 4, axisFixed: true });
    expect(kPaToPf(FIELD_CAPACITY_KPA)).toBeCloseTo(2, 1);
    // Suction has no ceiling of its own: the thresholds decide how far the axis
    // reaches, and they differ per field.
    expect(SOIL_SERIES_META.waterTension.axisMax).toBeUndefined();
    expect(SOIL_SERIES_META.waterTension.axisMin).toBe(0);
  });

  it('summarises the window even though nothing here accumulates', () => {
    const out = buildSoilSeries({
      key: 'waterTension', from: '2026-07-01', to: '2026-07-01',
      samples: [s('2026-07-01T09:00', { tension: 20 }), s('2026-07-01T10:00', { tension: 40 })],
    });
    expect(out.stats).toMatchObject({ min: 20, max: 40, avg: 30 });
    expect(out.anyMeasured).toBe(true);
  });

  it('answers with an empty window rather than nothing when the sensor was out', () => {
    const out = buildSoilSeries({
      key: 'waterTension', from: '2026-11-01', to: '2026-11-01', samples: [],
    });
    expect(out.stats).toBeNull();
    expect(out.anyMeasured).toBe(false);
    expect(out.samples).toHaveLength(24);
  });
});

describe('the suction axis', () => {
  const t = { scarce: 25, irrigate: 36, critical: 87 };

  it('runs from zero to a little past critical, whatever the window did', () => {
    // Dieleman's own thresholds, from the live API. A fitted axis would make a wet
    // week and a dry week the same picture; pinned, the line's height is the reading.
    const axis = soilTensionAxis(t, [{ value: 22 }, { value: 35 }]);
    expect(axis).toMatchObject({ axisMin: 0, axisFixed: true });
    expect(axis!.axisMax).toBeGreaterThan(87);
    // Same axis for a wetter week: that is the whole point.
    expect(soilTensionAxis(t, [{ value: 12 }])!.axisMax).toBe(axis!.axisMax);
  });

  it('still fits a reading that has gone past critical', () => {
    // A field in trouble must not be drawn off the top of its own chart.
    expect(soilTensionAxis(t, [{ value: 140 }])!.axisMax).toBe(140);
  });

  it('has no axis to pin for a field whose thresholds nobody has set', () => {
    expect(soilTensionAxis(null, [{ value: 30 }])).toBeNull();
  });
});

describe('pF, and the refill room with its rain', () => {
  it('converts a suction boundary to pF exactly, as the API computes it', () => {
    // Pinned against the live API on 18 September 2026: a reading of 35.30 kPa came
    // back with `pF: 2.56`. So the same four zones can sit behind either chart.
    expect(kPaToPf(35.30160866806753)).toBeCloseTo(2.56, 2);
    expect(kPaToPf(FIELD_CAPACITY_KPA)).toBeCloseTo(2.01, 2);
    // Saturated soil has no logarithm to take.
    expect(kPaToPf(0)).toBeNull();
    expect(kPaToPf(null)).toBeNull();
  });

  it('puts the rain in the bars and the room in the line, on one axis', () => {
    const rows = [
      s('2026-07-01T09:00', { refillMm: 30, precip: 2 }),
      s('2026-07-01T10:00', { refillMm: 22, precip: 8 }),
    ];
    const built = buildSoilSeries({
      key: 'refillMm', from: '2026-07-01', to: '2026-07-01', samples: rows,
    });
    const out = refillSeriesBars(rows, built);

    // Sharing the axis is the point: it is how you see that 8 mm did not close a
    // 30 mm gap.
    expect(out.samples[9]).toMatchObject({ value: 2, cumulative: 30 });
    expect(out.samples[10]).toMatchObject({ value: 8, cumulative: 22 });
    expect(SOIL_SERIES_META.refillMm.shape).toBe('bar');
  });

  it('sums the rain per day, where everything else here averages', () => {
    // A day's rainfall is a total. The mean of its hours is a number with no meaning,
    // which is why it cannot ride along on the series' own bucketing.
    const rows = [
      s('2026-07-01T09:00', { refillMm: 30, precip: 2 }),
      s('2026-07-01T15:00', { refillMm: 28, precip: 6 }),
      s('2026-07-05T09:00', { refillMm: 40, precip: 1 }),
    ];
    const built = buildSoilSeries({
      key: 'refillMm', from: '2026-07-01', to: '2026-07-05', samples: rows,
    });
    const out = refillSeriesBars(rows, built);
    expect(out.resolution).toBe('day');
    expect(out.samples[0]).toMatchObject({ key: '2026-07-01', value: 8 });
    expect(out.samples[4]).toMatchObject({ key: '2026-07-05', value: 1 });
  });

  it('draws no bar at all where the sensor has no gauge', () => {
    // A BASIC. No bar rather than a bar of nothing.
    const rows = [s('2026-07-01T09:00', { refillMm: 30, precip: null })];
    const built = buildSoilSeries({
      key: 'refillMm', from: '2026-07-01', to: '2026-07-01', samples: rows,
    });
    expect(refillSeriesBars(rows, built).samples[9]).toMatchObject({
      value: null, cumulative: 30,
    });
  });
});
