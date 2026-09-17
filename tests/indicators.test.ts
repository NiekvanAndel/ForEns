/**
 * Indicator layer tests.
 *
 * The point of building suction first is that the shape can be checked against real
 * thresholds on a real field instead of against a number the app chose for itself, so
 * these pin the shape as much as the quantity: which threshold binds, when a level
 * change is claimed, how far the indicator says it is talking about, and what happens
 * when the sensor is simply out of the ground.
 *
 * The four honesty rules each have a test, because a rule that lives only in a comment
 * is a rule the third renderer breaks.
 */
import { describe, it, expect } from 'vitest';
import {
  bindingThreshold, buildIndicator, certaintyOf, levelAt, nextTransition,
  soilThresholdSteps, thresholdZones, thresholdsInPlay, waterTensionIndicator,
  type IndicatorPoint,
} from '../core/model/indicators';
import type { Placement } from '../core/model/soil';
import type { SoilSample } from '../core/sources/agroexact';

/** Heesch: potato on fairly heavy clay, sensor at 30 cm, 25 / 45 / 60 kPa. */
const HEESCH: Placement = {
  stationId: 's1', placementId: 'p1', lat: 51.73, lon: 5.53,
  from: '2026-04-01T00:00:00Z', to: null,
  crop: 'Aardappel', soil: 'matig zware klei', depthCm: 30,
  thresholds: { scarce: 25, irrigate: 45, critical: 60 },
};

const STEPS = soilThresholdSteps(HEESCH.thresholds);

/** A soil sample with only the fields the indicator reads. */
function sample(time: string, tension: number, status: 0 | 1 | 2 | 3, extra: Partial<SoilSample> = {}): SoilSample {
  return {
    time,
    measTime: `${time.slice(0, 16)}:00Z`,
    tension, status,
    pF: null, waterPercent: null, refillMm: null, refillToScarceMm: null,
    soilTemp: null, temp10: null, humidity10: null, dewpoint10: null,
    leafWetProxy: null, precip: null,
    ...extra,
  };
}

describe('levels and the binding threshold', () => {
  it('puts a value in its band and names what is holding it there', () => {
    expect(levelAt(12, STEPS)).toBe(0);
    expect(levelAt(48, STEPS)).toBe(2);
    // "48 kPa — grens 45" is the whole sentence: without the binding threshold a
    // badge can say something is wrong but not why.
    expect(bindingThreshold(48, STEPS)).toEqual({ at: 45, level: 2 });
    // Nothing binds at level 0, and saying otherwise would put a boundary on a
    // reading that is simply fine.
    expect(bindingThreshold(12, STEPS)).toBeNull();
    expect(levelAt(null, STEPS)).toBeNull();
  });

  it('never occupies a collapsed level, and binds on the higher of the pair', () => {
    // A fifth of the account's sensors are set up this way: no suboptimal band.
    const flat = soilThresholdSteps({ scarce: 19.9, irrigate: 19.9, critical: 25 });
    expect(levelAt(10, flat)).toBe(0);
    expect(levelAt(19.9, flat)).toBe(2);
    expect(bindingThreshold(19.9, flat)).toEqual({ at: 19.9, level: 2 });
  });
});

describe('transitions', () => {
  const point = (time: string, value: number, level: number, observed: boolean): IndicatorPoint =>
    ({ time, value, level, observed });

  it('claims no change ahead when the course is measurement only', () => {
    const course = [
      point('2026-07-01T10:00', 30, 1, true),
      point('2026-07-01T11:00', 44, 1, true),
    ];
    // Honest rather than missing: there is no forecast in the series, so there is
    // nothing ahead to promise.
    expect(nextTransition(course, '2026-07-01T11:00')).toBeNull();
  });

  it('finds the first change ahead once a forecast joins the same series', () => {
    const course = [
      point('2026-07-01T11:00', 44, 1, true),
      point('2026-07-01T12:00', 46, 2, false),
      point('2026-07-01T13:00', 62, 3, false),
    ];
    const next = nextTransition(course, '2026-07-01T11:00')!;
    expect(next).toEqual({ time: '2026-07-01T12:00', from: 1, to: 2, observed: false });
  });

  it('does not read a gap in the sensor as the field improving', () => {
    const course = [
      point('2026-07-01T11:00', 48, 2, true),
      { time: '2026-07-01T12:00', value: null, level: null, observed: false },
      point('2026-07-01T13:00', 49, 2, false),
    ];
    expect(nextTransition(course, '2026-07-01T11:00')).toBeNull();
  });
});

describe('the four honesty rules', () => {
  const base = {
    id: 'x', shape: 'momentary' as const, quantity: 'waterTension',
    thresholds: STEPS, provenance: { kind: 'measured' as const, detail: null },
  };

  it('rule 1: claims exactly as far as the course reaches, and no further', () => {
    const measured = buildIndicator({
      ...base,
      course: [{ time: '2026-07-01T11:00', value: 48, level: 2, observed: true }],
      now: '2026-07-01T11:00',
    });
    // Nothing beyond now is claimed, which is not the same as claiming everything.
    expect(measured.horizon).toBeNull();

    const withForecast = buildIndicator({
      ...base,
      course: [
        { time: '2026-07-01T11:00', value: 48, level: 2, observed: true },
        { time: '2026-07-02T11:00', value: 55, level: 2, observed: false },
      ],
      now: '2026-07-01T11:00',
    });
    expect(withForecast.horizon).toBe('2026-07-02T11:00');
  });

  it('rule 2: one class, and it drops as the course reaches further out', () => {
    const now = '2026-07-01T11:00';
    const measured = [{ time: now, value: 48, level: 2, observed: true }];
    expect(certaintyOf(measured, now)).toBe('high');
    expect(certaintyOf(
      [...measured, { time: '2026-07-02T11:00', value: 52, level: 2, observed: false }], now
    )).toBe('medium');
    expect(certaintyOf(
      [...measured, { time: '2026-07-05T11:00', value: 60, level: 3, observed: false }], now
    )).toBe('low');
  });

  it('rule 3: every point says whether it was measured', () => {
    const ind = buildIndicator({
      ...base,
      course: [
        { time: '2026-07-01T11:00', value: 48, level: 2, observed: true },
        { time: '2026-07-01T12:00', value: 50, level: 2, observed: false },
      ],
      now: '2026-07-01T11:00',
    });
    expect(ind.course.map((p) => p.observed)).toEqual([true, false]);
    // The state is the last point at or before now, not the last point in the series:
    // a forecast must never be able to present itself as the current reading.
    expect(ind.now!.value).toBe(48);
  });

  it('rule 4: the origin travels with the indicator', () => {
    const ind = waterTensionIndicator(
      [sample('2026-07-01T11:00', 48, 2)], HEESCH, '2026-07-01T11:00',
      new Date('2026-07-01T11:30:00Z')
    )!;
    expect(ind.provenance.kind).toBe('measured');
    // A suction reading cannot be read without crop, soil and depth, so they are not
    // decoration on the page — they are part of the indicator.
    expect(ind.provenance.detail).toBe('Aardappel · matig zware klei · 30 cm');
  });
});

describe('suction as the first indicator', () => {
  const now = '2026-07-01T11:00';
  const clock = new Date('2026-07-01T11:30:00Z');

  it('fills every field of the shape from something that already exists', () => {
    const ind = waterTensionIndicator([
      sample('2026-07-01T09:00', 41, 1),
      sample('2026-07-01T10:00', 44, 1),
      sample('2026-07-01T11:00', 48, 2, { refillMm: 33, refillToScarceMm: 18 }),
    ], HEESCH, now, clock)!;

    expect(ind.shape).toBe('momentary');
    expect(ind.levels).toBe(4);
    expect(ind.thresholds).toEqual([{ at: 25, level: 1 }, { at: 45, level: 2 }, { at: 60, level: 3 }]);
    expect(ind.now).toEqual({
      level: 2,
      value: 48,
      binding: { at: 45, level: 2 },
      // "Beregen nu — 48 kPa, grens 45, vul 18–33 mm bij". No other indicator on the
      // list can state an amount at all.
      amount: { min: 18, max: 33 },
    });
    expect(ind.certainty).toBe('high');
    expect(ind.id).toBe('soil:p1:tension');
  });

  it('keeps the status the API froze, rather than recomputing last season against today', () => {
    // A reading of 48 under thresholds that were 25/45/60 that day is status 2. If the
    // field has since moved to sand, recomputing it would put it at 3 — the
    // retroactive rewrite the placement exists to prevent.
    const ind = waterTensionIndicator(
      [sample('2026-07-01T11:00', 48, 2)],
      { ...HEESCH, thresholds: { scarce: 18, irrigate: 30, critical: 40 } },
      now, clock
    )!;
    expect(ind.course[0]!.level).toBe(2);
  });

  it('falls back to the placement thresholds only where a row carries no status', () => {
    const noStatus = { ...sample('2026-07-01T11:00', 48, 2), status: null };
    const ind = waterTensionIndicator([noStatus], HEESCH, now, clock)!;
    expect(ind.course[0]!.level).toBe(2);
  });

  it('offers an amount only once there is a decision to support', () => {
    const fine = waterTensionIndicator(
      [sample('2026-07-01T11:00', 30, 1, { refillMm: 12, refillToScarceMm: 4 })],
      HEESCH, now, clock
    )!;
    // There is refill room at status 1 too; stating it would read as an instruction
    // to irrigate a field that does not need it.
    expect(fine.now!.amount).toBeNull();
  });

  it('reads the amount from the same sample as the state, not from the end of the series', () => {
    // Nothing appends a forecast sample yet, but the day 4c does, a top-up computed
    // from tomorrow must not appear beside a reading from this morning.
    const ind = waterTensionIndicator([
      sample('2026-07-01T11:00', 48, 2, { refillMm: 33, refillToScarceMm: 18 }),
      sample('2026-07-01T14:00', 58, 2, { refillMm: 41, refillToScarceMm: 26 }),
    ], HEESCH, now, clock)!;
    expect(ind.now!.value).toBe(48);
    expect(ind.now!.amount).toEqual({ min: 18, max: 33 });
  });

  it('goes quiet when the sensor is out of the ground, without calling it a fault', () => {
    const autumn = new Date('2026-11-01T12:00:00Z');
    expect(waterTensionIndicator(
      [sample('2026-10-01T11:00', 22, 0)], HEESCH, '2026-11-01T12:00', autumn
    )).toBeNull();
    // And an empty season is nothing at all, not a broken indicator.
    expect(waterTensionIndicator([], HEESCH, now, clock)).toBeNull();
  });
});

describe('threshold lines on a chart', () => {
  it('draws the boundaries the series is measurably near', () => {
    // Heesch in July: 12–48 kPa against 25 / 45 / 60. All three are in play — the
    // point of the chart is seeing how near critical you are.
    expect(thresholdsInPlay(STEPS, 12, 48).map((t) => t.at)).toEqual([25, 45, 60]);
  });

  it('leaves out a boundary that is nowhere near, rather than flattening the series', () => {
    // A field sitting at 18–22 kPa whose critical is 200: stretching the axis to
    // reach it would draw the whole summer as a line along the bottom.
    const far = [{ at: 30, level: 1 }, { at: 60, level: 2 }, { at: 200, level: 3 }];
    expect(thresholdsInPlay(far, 18, 22).map((t) => t.at)).toEqual([30]);
  });

  it('still draws a boundary just above a series that barely moves', () => {
    // No span to reason from, so a share of the reading itself stands in. Without
    // that, a steady field loses its threshold line exactly when it is closest to it.
    expect(thresholdsInPlay(STEPS, 44, 44).map((t) => t.at)).toEqual([45]);
  });

  it('sorts the boundaries, whatever order they arrived in', () => {
    const jumbled = [{ at: 60, level: 3 }, { at: 25, level: 1 }, { at: 45, level: 2 }];
    expect(thresholdsInPlay(jumbled, 12, 48).map((t) => t.at)).toEqual([25, 45, 60]);
  });

  it('runs each zone up to the next boundary, and the highest to the ceiling', () => {
    expect(thresholdZones(STEPS, 70)).toEqual([
      { at: 25, level: 1, from: 25, to: 45 },
      { at: 45, level: 2, from: 45, to: 60 },
      { at: 60, level: 3, from: 60, to: 70 },
    ]);
  });

  it('gives a collapsed band no height at all', () => {
    // Drawn as nothing, rather than as a sliver in the colour of a state the field
    // can never be in.
    const flat = soilThresholdSteps({ scarce: 19.9, irrigate: 19.9, critical: 25 });
    const zones = thresholdZones(flat, 40);
    expect(zones[0]!.to - zones[0]!.from).toBe(0);
    expect(zones[1]!.to).toBe(25);
  });

  it('keeps the series worth looking at when it stretches for a boundary', () => {
    // The rule stated as what it protects: a quarter of the axis, at least.
    const marks = thresholdsInPlay(STEPS, 18, 22);
    const hi = Math.max(22, ...marks.map((m) => m.at));
    const lo = Math.min(18, ...marks.map((m) => m.at));
    expect((22 - 18) / (hi - lo)).toBeGreaterThanOrEqual(0.25);
  });

  it('leaves the zone below the lowest boundary unshaded', () => {
    // Where nothing is wrong, nothing is coloured: shading "fine" spends the chart's
    // loudest device on its least interesting state.
    const zones = thresholdZones(STEPS, 70);
    expect(Math.min(...zones.map((z) => z.from))).toBe(25);
  });

  it('hands an indicator straight to the chart, with no second bands mechanism', () => {
    // The claim from sheet 1: one prop, and the indicator already knows its grens.
    const ind = waterTensionIndicator(
      [sample('2026-07-01T11:00', 48, 2)], HEESCH, '2026-07-01T11:00',
      new Date('2026-07-01T11:30:00Z')
    )!;
    expect(thresholdsInPlay(ind.thresholds, 12, 48)).toEqual(ind.thresholds);
  });
});
