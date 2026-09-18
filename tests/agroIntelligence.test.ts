/**
 * AgroIntelligence — the add-on tier.
 *
 * Three things are being pinned here, and the third is the one that decides whether
 * this is a tier at all.
 *
 *  1. **That the conclusions are about the farm.** A joint window, an order, a spread
 *     and a de-duplicated boundary are all sentences no single location can produce,
 *     so every one of them refuses to answer for fewer than two locations.
 *  2. **That a chance is counted, never modelled.** The ladder says nothing where the
 *     members said nothing, and the rungs move with the reader's appetite rather than
 *     with the weather.
 *  3. **That the tier is separable.** With it off its widgets are not in the
 *     arrangement, which is also what stops their sources being fetched — the
 *     difference between a feature that is hidden and one that is not paid for.
 */
import { describe, it, expect } from 'vitest';
import {
  areaConclusions, jointWindow, rainSpread, sharedBoundaries, workOrder,
} from '../core/areaConclusions';
import {
  decisionFor, riskStatements, rungFor, LADDER, SETTLED_HIGH,
} from '../core/riskLadder';
import { certaintyOpacity, dayWindows, workableShare } from '../core/dayWindows';
import { arrangeWidgets, neededSources, widgetsFor, OVERVIEW_WIDGETS } from '../core/overview';
import { mergePrefs, DEFAULT_PREFS } from '../core/prefs';
import type { OverviewRow, OutlookHour } from '../core/overviewData';
import type { EnsembleDay } from '../core/sources/ensembleOutlook';
import type { LocationAdvice } from '../core/overviewFieldAdvice';
import type { AdviceReading } from '../core/model/fieldAdvice';

const DAY = '2026-04-20';
const start = Date.parse(`${DAY}T06:00:00Z`);

const hour = (i: number, over: Partial<OutlookHour> = {}): OutlookHour => ({
  time: new Date(start + i * 3600000).toISOString().slice(0, 16),
  temp: 12, humidity: 70, precip: 0, wind: 10, gusts: 18, isDay: 1,
  ...over,
});

/** A location whose hours are workable except where `stop` says otherwise. */
function row(
  index: number,
  name: string,
  over: Partial<OverviewRow> = {},
  stop: (i: number) => Partial<OutlookHour> | null = () => null
): OverviewRow {
  return {
    index, name, hasStation: false, loading: false,
    measured: {
      temp: false, humidity: false, wind: false, gusts: false, windDir: false, precip: false,
    },
    tempC: 12, humidity: 70, windKmh: 10, gustKmh: 18, windDir: 180, wmo: 1,
    rain24: 0, rainToday: 0, rainNext24: 0, tonightMinC: 5,
    days: [],
    hours: Array.from({ length: 12 }, (_, i) => hour(i, stop(i) ?? {})),
    rainTrail: [], tempTrail: [], ensemble: null,
    ...over,
  };
}

function advice(index: number, name: string, readings: Partial<AdviceReading>[]): LocationAdvice {
  const full = readings.map((r, i) => ({
    id: `advice:${i}`, family: 'spray', factor: 'sprayWind', level: 2,
    value: 21, limit: 18, unit: 'kmh', at: null, window: null, closes: null,
    certainty: 'high', horizon: null, provenance: { kind: 'modelled', detail: null },
    ...r,
  })) as AdviceReading[];
  return { index, name, readings: full, level: 2 };
}

describe('conclusions about the farm', () => {
  it('says nothing at all about a single location', () => {
    // The whole tier is "what you cannot get from one field", so one field gets
    // nothing — not a degraded version of it.
    expect(areaConclusions([row(0, 'Heesch')], [])).toEqual([]);
    expect(jointWindow([row(0, 'Heesch')])).toBeNull();
    expect(workOrder([row(0, 'Heesch')])).toBeNull();
  });

  it('finds the stretch every location can be worked in', () => {
    const wetLater = (i: number) => (i >= 6 ? { precip: 2 } : null);
    const wetEarly = (i: number) => (i < 2 ? { precip: 2 } : null);
    const joint = jointWindow([
      row(0, 'Heesch', {}, wetLater),
      row(1, 'Rosmalen', {}, wetEarly),
    ])!;
    expect(joint.kind).toBe('commonWindow');
    expect(joint.from).toBe('2026-04-20T08:00');
    expect(joint.hours).toBe(4);
    expect(joint.count).toBe(2);
  });

  it('answers how many at best, rather than "no window", when nothing is joint', () => {
    // The "de drie in Zeeland vallen af op wind" case: a different sentence from
    // there being no window at all, and the useful one.
    const joint = jointWindow([
      row(0, 'Heesch'),
      row(1, 'Zeeland', {}, () => ({ wind: 40 })),
    ])!;
    expect(joint.kind).toBe('noCommonWindow');
    expect(joint).toMatchObject({ count: 1, total: 2 });
  });

  it('refuses a joint window too short to get to a field inside', () => {
    // True and useless is worse than silent, because somebody will try.
    const joint = jointWindow([
      row(0, 'Heesch', {}, (i) => (i >= 1 ? { precip: 2 } : null)),
      row(1, 'Rosmalen', {}, (i) => (i >= 1 ? { precip: 2 } : null)),
    ])!;
    expect(joint.kind).toBe('noCommonWindow');
  });

  it('starts on the field whose window shuts first, and names what follows', () => {
    const order = workOrder([
      row(0, 'Heesch', {}, (i) => (i >= 6 ? { precip: 2 } : null)),
      row(1, 'Rosmalen', {}, (i) => (i >= 3 ? { precip: 2 } : null)),
    ])!;
    expect(order.place).toBe('Rosmalen');
    expect(order.place2).toBe('Heesch');
    expect(order.to).toBe('2026-04-20T09:00');
  });

  it('will not order fields nobody can get on to yet', () => {
    // Both start wet: there is a plan for later, and it is not an order for now.
    expect(workOrder([
      row(0, 'Heesch', {}, (i) => (i < 4 ? { precip: 2 } : null)),
      row(1, 'Rosmalen', {}, (i) => (i < 5 ? { precip: 2 } : null)),
    ])).toBeNull();
  });

  it('calls a rainfall spread only when it is both a gap and a ratio', () => {
    // 22 against 1,4: what a grower means by "it missed us".
    expect(rainSpread([
      row(0, 'Heesch', { rain24: 22 }), row(1, 'Rosmalen', { rain24: 1.4 }),
    ])).toMatchObject({ kind: 'spread', place: 'Heesch', mm: 22, place2: 'Rosmalen', mm2: 1.4 });

    // A big gap between two wet fields is not a spread — both got soaked.
    expect(rainSpread([
      row(0, 'Heesch', { rain24: 30 }), row(1, 'Rosmalen', { rain24: 19 }),
    ])).toBeNull();

    // And a big ratio between two dry ones is arithmetic, not weather.
    expect(rainSpread([
      row(0, 'Heesch', { rain24: 0.3 }), row(1, 'Rosmalen', { rain24: 0.1 }),
    ])).toBeNull();
  });

  it('says one boundary once instead of five fields five times', () => {
    const shut = [{ family: 'spray' as const, factor: 'sprayWind' as const, level: 2 as const }];
    const [line] = sharedBoundaries([
      advice(0, 'Heesch', shut), advice(1, 'Rosmalen', shut), advice(2, 'Nistelrode', shut),
    ]);
    expect(line).toMatchObject({ kind: 'shared', factor: 'sprayWind', count: 3, total: 3 });
  });

  it('counts a field once per boundary, however many readings carry it', () => {
    const twice = [
      { id: 'a', factor: 'sprayWind' as const, level: 2 as const },
      { id: 'b', factor: 'sprayWind' as const, level: 2 as const },
    ];
    const [line] = sharedBoundaries([advice(0, 'Heesch', twice), advice(1, 'Rosmalen', twice)]);
    expect(line?.count).toBe(2);
  });

  it('leaves the merely watchful out of the shared line', () => {
    // A boundary worth watching at five fields is not five fields lost.
    const watch = [{ factor: 'frostGround' as const, level: 1 as const, family: 'frost' as const }];
    expect(sharedBoundaries([advice(0, 'a', watch), advice(1, 'b', watch)])).toEqual([]);
  });

  it('will not call one field a pattern', () => {
    const shut = [{ factor: 'sprayWind' as const, level: 2 as const }];
    expect(sharedBoundaries([advice(0, 'Heesch', shut)])).toEqual([]);
  });
});

describe('the escalation ladder', () => {
  it('has three rungs and reaches none below the first', () => {
    expect(rungFor(90, 'normal')).toBe('act');
    expect(rungFor(LADDER.prepare, 'normal')).toBe('prepare');
    expect(rungFor(LADDER.watch, 'normal')).toBe('watch');
    // Not a fourth rung called "nothing": a row that says nothing is likely is the
    // noise the tier exists to remove.
    expect(rungFor(12, 'normal')).toBeNull();
  });

  it('moves with the reader rather than with the weather', () => {
    const chance = 20;
    expect(rungFor(chance, 'cautious')).toBe('watch');
    expect(rungFor(chance, 'normal')).toBeNull();
    expect(rungFor(50, 'patient')).toBe('watch');
    expect(rungFor(50, 'normal')).toBe('watch');
    expect(rungFor(65, 'patient')).toBe('watch');
    expect(rungFor(65, 'normal')).toBe('prepare');
  });

  it('says nothing where the members said nothing', () => {
    expect(rungFor(null, 'cautious')).toBeNull();
    expect(decisionFor(null)).toBeNull();
  });

  it('knows when waiting would not improve the answer', () => {
    expect(decisionFor(SETTLED_HIGH)).toBe('settled-yes');
    expect(decisionFor(4)).toBe('settled-no');
    expect(decisionFor(45)).toBe('open');
  });
});

describe('chances per location', () => {
  const day = (over: Partial<EnsembleDay> = {}): EnsembleDay => ({
    date: DAY, p10: 0, p50: 0, p90: 0, wetShare: 0, members: 51,
    minP10: null, minP50: null, minP90: null, frostShare: null,
    ...over,
  });

  it('counts frost over the members, with the middle one beside it', () => {
    const [first] = riskStatements(
      [{ index: 0, name: 'Heesch', ensemble: [day({ frostShare: 65, minP50: -1.2 })] }],
      'normal'
    );
    expect(first).toMatchObject({
      kind: 'frost', percent: 65, rung: 'prepare', median: -1.2, members: 51,
    });
  });

  it('stays silent about frost the members did not speak about', () => {
    // Null is not "no frost": an older run with no minimum in it says nothing, and
    // reassuring somebody on the strength of a gap is the worst reading of it.
    expect(riskStatements(
      [{ index: 0, name: 'Heesch', ensemble: [day({ frostShare: null, wetShare: 5 })] }],
      'normal'
    )).toEqual([]);
  });

  it('puts what to act on above what to watch, and frost above rain', () => {
    const kinds = riskStatements([
      { index: 0, name: 'Heesch', ensemble: [day({ wetShare: 95 })] },
      { index: 1, name: 'Rosmalen', ensemble: [day({ frostShare: 40, minP50: 0.5 })] },
      { index: 2, name: 'Nistelrode', ensemble: [day({ frostShare: 90, minP50: -2 })] },
    ], 'normal').map((r) => `${r.rung}-${r.kind}`);
    expect(kinds[0]).toBe('act-frost');
    expect(kinds[1]).toBe('act-rain');
    expect(kinds[2]).toBe('watch-frost');
  });

  it('has nothing to say without an ensemble', () => {
    expect(riskStatements([{ index: 0, name: 'Heesch', ensemble: null }], 'cautious')).toEqual([]);
  });
});

describe('the days as windows', () => {
  const hours = [
    ...Array.from({ length: 6 }, (_, i) => hour(i)),
    ...Array.from({ length: 4 }, (_, i) => hour(6 + i, { precip: 2 })),
    // The next day, entirely workable.
    ...Array.from({ length: 5 }, (_, i) => ({
      ...hour(i), time: `2026-04-21T0${i}:00`,
    })),
  ];

  it("splits by the location's own calendar day, however short today is", () => {
    const days = dayWindows(hours, null);
    expect(days.map((d) => d.date)).toEqual(['2026-04-20', '2026-04-21']);
    expect(days[0]).toMatchObject({ workable: 6, hours: 10 });
    expect(days[1]).toMatchObject({ workable: 5, hours: 5 });
  });

  it('reads a day quality rather than its length', () => {
    const days = dayWindows(hours, null);
    expect(workableShare(days[1]!)).toBe(1);
    expect(workableShare(days[0]!)).toBeCloseTo(0.6, 2);
  });

  it('carries the run a day is planned around', () => {
    expect(dayWindows(hours, null)[0]?.run).toMatchObject({ from: '2026-04-20T06:00', hours: 6 });
  });

  it('fades a day the members disagree about, and draws an unknown one solid', () => {
    const ens = [{
      date: '2026-04-20', p10: 0, p50: 1, p90: 9, wetShare: 50, members: 51,
      minP10: null, minP50: null, minP90: null, frostShare: null,
    }];
    const days = dayWindows(hours, ens);
    expect(days[0]?.agreement).toBe('disagree');
    expect(certaintyOpacity(days[0]?.agreement ?? null)).toBeLessThan(1);
    // No ensemble is no reason to doubt, so no fade.
    expect(certaintyOpacity(days[1]?.agreement ?? null)).toBe(1);
  });

  it('has nothing to compare without hours', () => {
    expect(dayWindows([], null)).toEqual([]);
  });
});

describe('the tier as a tier', () => {
  const tiered = OVERVIEW_WIDGETS.filter((w) => w.tier === 'agroIntel').map((w) => w.id);

  it('is off for somebody who has not bought it', () => {
    expect(DEFAULT_PREFS.agroIntel).toEqual({ enabled: false, risk: 'normal' });
    // And a stored value that lost the switch does not turn a paid tier on.
    expect(mergePrefs({ agroIntel: { risk: 'cautious' } }).agroIntel)
      .toEqual({ enabled: false, risk: 'cautious' });
    expect(mergePrefs({ agroIntel: { enabled: true, risk: 'nonsense' } }).agroIntel)
      .toEqual({ enabled: true, risk: 'normal' });
  });

  it('keeps its widgets out of the arrangement entirely when off', () => {
    expect(tiered.length).toBeGreaterThan(0);
    const off = arrangeWidgets({ order: [], hidden: [] }).map((w) => w.id);
    for (const id of tiered) expect(off).not.toContain(id);

    const on = arrangeWidgets({ order: [], hidden: [] }, { agroIntel: true }).map((w) => w.id);
    for (const id of tiered) expect(on).toContain(id);
  });

  it('does not fetch what the tier would have read', () => {
    // The point of filtering the arrangement rather than the render: a tier that is
    // off costs nothing per location, which is what separates it from a hidden one.
    const off = neededSources({ order: [], hidden: [] });
    const on = neededSources({ order: [], hidden: [] }, { agroIntel: true });
    expect(on.size).toBeGreaterThanOrEqual(off.size);

    // With every basis widget that reads the ensemble switched off, the tier is the
    // only thing that could ask for it.
    const basisEnsemble = widgetsFor()
      .filter((w) => w.needs.includes('ensemble'))
      .map((w) => w.id);
    expect(neededSources({ order: [], hidden: basisEnsemble }).has('ensemble')).toBe(false);
    expect(neededSources({ order: [], hidden: basisEnsemble }, { agroIntel: true }).has('ensemble'))
      .toBe(true);
  });

  it('offers the tier only where it was asked for', () => {
    expect(widgetsFor().some((w) => w.tier)).toBe(false);
    expect(widgetsFor({ agroIntel: true }).some((w) => w.tier === 'agroIntel')).toBe(true);
  });
});
