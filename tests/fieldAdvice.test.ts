/**
 * The four rule-based families: spraying, frost, workability, fertilising.
 *
 * Two kinds of case carry the weight here. The first is which boundary **binds**: a
 * badge that says wind when it was really Delta T sends somebody out to wait for a
 * wind that was never the problem, so the order the reasons are tried in is tested
 * rather than assumed. The second is silence — a family whose inputs are missing has
 * to produce nothing at all, because a reading with no number behind it is not a
 * quieter statement, it is a wrong one.
 */
import { describe, it, expect } from 'vitest';
import {
  fieldAdvice, sprayBlock, tSum, adviceLevel, byUrgency,
  ADVICE_FAMILIES, SPRAY_WIND_MAX, TSUM_TARGET,
  type AdviceReading,
} from '../core/model/fieldAdvice';
import { deltaT, wetBulb } from '../core/model/psychro';
import type { Day, Hour } from '../core/model/types';

const NOW = '2026-04-20T06:00';

/** A quiet, sprayable hour: light wind, Delta T 4,8, dry, daylight. */
function hour(over: Partial<Hour> = {}): Hour {
  return {
    time: NOW, temp: 18, precip: 0, wind: 12, humidity: 60,
    wmo: 1, isDay: 1, isPast: false, gusts: 18, windDir: 180, et0h: 0.2,
    ...over,
  };
}

/** Consecutive hours from `NOW`, so a window carries stamps that make sense. */
function run(count: number, over: Partial<Hour> | ((i: number) => Partial<Hour>) = {}): Hour[] {
  const start = Date.parse(`${NOW}:00Z`);
  return Array.from({ length: count }, (_, i) => hour({
    time: new Date(start + i * 3600000).toISOString().slice(0, 16),
    ...(typeof over === 'function' ? over(i) : over),
  }));
}

function day(date: string, precipMedian: number): Day {
  return { date, precipMedian } as unknown as Day;
}

function advice(over: Partial<Parameters<typeof fieldAdvice>[0]> = {}): AdviceReading[] {
  return fieldAdvice({
    hours: run(48), past: [], days: [], nowKey: NOW, ...over,
  });
}

const find = (list: AdviceReading[], id: string) => list.find((r) => r.id === id);

describe('wetBulb and deltaT', () => {
  it('matches Stull to a tenth at 20 °C and 50 % RH', () => {
    expect(wetBulb(20, 50)).toBeCloseTo(13.7, 1);
    expect(deltaT(20, 50)).toBeCloseTo(6.3, 1);
  });

  it('closes on the dry bulb as the air saturates', () => {
    expect(deltaT(18, 95)).toBeLessThan(1);
  });

  it('refuses rather than extrapolates outside the range the fit covers', () => {
    expect(wetBulb(18, 2)).toBeNull();
    expect(wetBulb(60, 50)).toBeNull();
    expect(wetBulb(null, 50)).toBeNull();
    expect(deltaT(18, undefined)).toBeNull();
  });
});

describe('tSum', () => {
  it('sums the daily means and leaves out the days below zero', () => {
    expect(tSum([3, 5, -4, 2])).toBe(10);
  });

  it('skips gaps rather than counting them as zero-degree days', () => {
    expect(tSum([3, null, undefined, 2])).toBe(5);
  });
});

describe('sprayBlock', () => {
  it('lets a quiet hour through', () => {
    expect(sprayBlock(hour(), 0, [])).toBeNull();
  });

  it('names wind first, with the legal limit beside the reading', () => {
    const block = sprayBlock(hour({ wind: 21 }), 0, []);
    expect(block?.factor).toBe('sprayWind');
    expect(block?.value).toBe(21);
    expect(block?.limit).toBe(SPRAY_WIND_MAX);
  });

  it('prefers the wind to everything else it could have said', () => {
    // Too warm, Delta T over the top, rain coming — and still the legal limit binds.
    const block = sprayBlock(hour({ wind: 30, temp: 28, humidity: 35 }), 5, []);
    expect(block?.factor).toBe('sprayWind');
  });

  it('blocks on Delta T from both sides', () => {
    expect(sprayBlock(hour({ humidity: 95 }), 0, [])?.factor).toBe('sprayDeltaTLow');
    expect(sprayBlock(hour({ temp: 25, humidity: 40 }), 0, [])?.factor).toBe('sprayDeltaTHigh');
  });

  it('blocks on rain inside the rainfastness window', () => {
    const block = sprayBlock(hour(), 1.2, []);
    expect(block?.factor).toBe('sprayRain');
    expect(block?.value).toBe(1.2);
  });

  it('blocks on heat and on cold, each against its own limit', () => {
    expect(sprayBlock(hour({ temp: 28, humidity: 55 }), 0, [])?.factor).toBe('sprayHeat');
    expect(sprayBlock(hour({ temp: -1, humidity: 90 }), 0, [])?.factor).toBe('sprayCold');
  });

  it('reads a night that keeps its calm as an inversion, and marks it a proxy', () => {
    const night = hour({ isDay: 0, wind: 2, humidity: 80 });
    const block = sprayBlock(night, 0, [hour({ wind: 2 }), hour({ wind: 2 }), hour({ wind: 1 })]);
    expect(block?.factor).toBe('sprayInversion');
    expect(block?.proxy).toBe(true);
  });

  it('does not call it an inversion when the wind is already coming back', () => {
    const night = hour({ isDay: 0, wind: 2, humidity: 80 });
    expect(sprayBlock(night, 0, [hour({ wind: 12 }), hour({ wind: 14 }), hour({ wind: 15 })]))
      .toBeNull();
  });
});

describe('fieldAdvice — spraying', () => {
  it('reports the window it is open until, and what closes it', () => {
    const hours = run(48, (i) => (i < 6 ? {} : { wind: 24 }));
    const spray = find(advice({ hours }), 'advice:spray');
    expect(spray?.factor).toBe('sprayOpen');
    expect(spray?.level).toBe(0);
    expect(spray?.window).toEqual({ from: NOW, to: '2026-04-20T12:00' });
    expect(spray?.closes).toBe('sprayWind');
    expect(spray?.value).toBe(24);
  });

  it('names what holds it shut, and when it opens again', () => {
    const hours = run(48, (i) => (i < 4 ? { wind: 24 } : {}));
    const spray = find(advice({ hours }), 'advice:spray');
    expect(spray?.factor).toBe('sprayWind');
    expect(spray?.level).toBe(2);
    expect(spray?.window?.from).toBe('2026-04-20T10:00');
  });

  it('warns rather than shuts on an inversion, which is inferred', () => {
    const hours = run(48, { isDay: 0, wind: 2, humidity: 80 });
    const spray = find(advice({ hours }), 'advice:spray');
    expect(spray?.level).toBe(1);
    expect(spray?.provenance.kind).toBe('proxy');
  });

  it('says there is no window rather than offering one past its horizon', () => {
    const spray = find(advice({ hours: run(48, { wind: 30 }) }), 'advice:spray');
    expect(spray?.window).toBeNull();
    expect(spray?.level).toBe(2);
  });

  it('claims exactly as far as it looks', () => {
    // 60 hours of forecast, a 48-hour horizon: the reading stops at hour 48.
    const spray = find(advice({ hours: run(60) }), 'advice:spray');
    expect(spray?.horizon).toBe('2026-04-22T05:00');
  });

  it('has nothing to say without hours', () => {
    expect(find(advice({ hours: [] }), 'advice:spray')).toBeUndefined();
  });
});

describe('fieldAdvice — frost', () => {
  it('flags night frost at the coldest hour it found', () => {
    const hours = run(48, (i) => (i === 20 ? { temp: -1, humidity: 90 } : {}));
    const frost = find(advice({ hours }), 'advice:frost');
    expect(frost?.factor).toBe('frostAir');
    expect(frost?.level).toBe(2);
    expect(frost?.value).toBe(-1);
    expect(frost?.at).toBe('2026-04-21T02:00');
  });

  it('separates blossom frost from ordinary night frost', () => {
    const hours = run(48, (i) => (i === 20 ? { temp: -3, humidity: 90 } : {}));
    expect(find(advice({ hours }), 'advice:frost')?.factor).toBe('frostBlossom');
  });

  it('calls the ground-frost band a proxy, because 1.50 m is not the ground', () => {
    const hours = run(48, (i) => (i === 10 ? { temp: 1, humidity: 90 } : {}));
    const frost = find(advice({ hours }), 'advice:frost');
    expect(frost?.factor).toBe('frostGround');
    expect(frost?.level).toBe(1);
    expect(frost?.provenance.kind).toBe('proxy');
  });

  it('still answers on a mild week, rather than going quiet', () => {
    const frost = find(advice(), 'advice:frost');
    expect(frost?.factor).toBe('frostNone');
    expect(frost?.level).toBe(0);
  });

  it('answers the irrigation question only when there is frost to answer it about', () => {
    expect(find(advice(), 'advice:frost-irrigation')).toBeUndefined();

    const mild = run(48, (i) => (i === 20 ? { temp: -2, humidity: 90 } : {}));
    expect(find(advice({ hours: mild }), 'advice:frost-irrigation')?.level).toBe(0);

    const harsh = run(48, (i) => (i === 20 ? { temp: -4, humidity: 85 } : {}));
    const cold = find(advice({ hours: harsh }), 'advice:frost-irrigation');
    expect(cold?.level).toBe(2);
    expect(cold?.value).toBeLessThan(-5);
  });

  it('drops its certainty for a frost three nights out', () => {
    const far = run(72, (i) => (i === 68 ? { temp: -2, humidity: 90 } : {}));
    expect(find(advice({ hours: far }), 'advice:frost')?.certainty).toBe('low');
  });
});

describe('fieldAdvice — workability', () => {
  it('shuts the land when the week put in more than it took out', () => {
    const wet = run(7 * 24, { precip: 0.5, et0h: 0.05 });
    const traffic = find(advice({ past: wet }), 'advice:traffic');
    expect(traffic?.level).toBe(2);
    expect(traffic?.provenance.kind).toBe('proxy');
  });

  it('leaves it open after a drying week', () => {
    const dry = run(7 * 24, { precip: 0, et0h: 0.2 });
    expect(find(advice({ past: dry }), 'advice:traffic')?.level).toBe(0);
  });

  it('says nothing about trafficability without a day of history behind it', () => {
    expect(find(advice({ past: run(6) }), 'advice:traffic')).toBeUndefined();
  });

  it('claims nothing ahead: a water balance is what has happened', () => {
    const dry = run(7 * 24, { precip: 0, et0h: 0.2 });
    expect(find(advice({ past: dry }), 'advice:traffic')?.horizon).toBeNull();
  });

  it('finds three dry days in a row and says which day they start', () => {
    const days = [
      day('2026-04-20', 4), day('2026-04-21', 0.2), day('2026-04-22', 0),
      day('2026-04-23', 0.1), day('2026-04-24', 6),
    ];
    const mowing = find(advice({ days }), 'advice:mowing');
    expect(mowing?.level).toBe(0);
    expect(mowing?.at).toBe('2026-04-21T00:00');
  });

  it('reports the absence of a window rather than the nearest thing to one', () => {
    const days = [
      day('2026-04-20', 4), day('2026-04-21', 0), day('2026-04-22', 3),
      day('2026-04-23', 0), day('2026-04-24', 6),
    ];
    const mowing = find(advice({ days }), 'advice:mowing');
    expect(mowing?.level).toBe(1);
    expect(mowing?.at).toBeNull();
  });

  it('leaves out the days already behind it', () => {
    const days = [day('2026-04-18', 0), day('2026-04-19', 0), day('2026-04-20', 5)];
    // Two dry days, but both are in the past: what is left is one day, not a window.
    expect(find(advice({ days }), 'advice:mowing')).toBeUndefined();
  });

  it('counts the fortnight deficit as drought, in the air and not the root zone', () => {
    const dry = run(14 * 24, { precip: 0, et0h: 0.2 });
    const drought = find(advice({ past: dry }), 'advice:drought');
    expect(drought?.level).toBe(2);
    expect(drought?.provenance.kind).toBe('proxy');
  });
});

describe('fieldAdvice — fertilising', () => {
  it('bars frozen ground outright', () => {
    const frozen = advice({
      past: run(12, { temp: -3, humidity: 85 }),
      hours: run(48, { temp: -2, humidity: 85 }),
    });
    const bar = find(frozen, 'advice:fert-frozen');
    expect(bar?.factor).toBe('fertFrozen');
    expect(bar?.level).toBe(2);
  });

  it('warns on frost to come without calling the ground frozen yet', () => {
    const soon = advice({
      past: run(12, { temp: 6, humidity: 85 }),
      hours: run(48, (i) => (i === 8 ? { temp: -1, humidity: 85 } : { temp: 6, humidity: 85 })),
    });
    const bar = find(soon, 'advice:fert-frozen');
    expect(bar?.factor).toBe('fertFrostAhead');
    expect(bar?.level).toBe(1);
  });

  it('stays silent about frozen ground on a mild week', () => {
    expect(find(advice({ past: run(12) }), 'advice:fert-frozen')).toBeUndefined();
  });

  it('reads warm, dry hours as emission risk and names the warmest', () => {
    const hot = advice({ hours: run(48, { temp: 22, humidity: 45 }) });
    const emission = find(hot, 'advice:fert-emission');
    expect(emission?.level).toBe(2);
    expect(emission?.value).toBe(22);
  });

  it('calls a cool, humid day a good one', () => {
    const mild = advice({ hours: run(48, { temp: 9, humidity: 88 }) });
    expect(find(mild, 'advice:fert-emission')?.level).toBe(0);
  });

  it('holds off on rain that would take the nitrogen past the roots', () => {
    const wet = advice({ hours: run(48, { precip: 1 }) });
    const leaching = find(wet, 'advice:fert-leaching');
    expect(leaching?.level).toBe(2);
    expect(leaching?.value).toBe(48);
  });

  it('says nothing about leaching on a dry forecast', () => {
    expect(find(advice(), 'advice:fert-leaching')).toBeUndefined();
  });

  it('speaks about the T-sum only once it has been handed a season', () => {
    expect(find(advice(), 'advice:fert-tsum')).toBeUndefined();
    expect(find(advice({ tSum: TSUM_TARGET + 20 }), 'advice:fert-tsum')?.level).toBe(0);
    expect(find(advice({ tSum: 120 }), 'advice:fert-tsum')?.level).toBe(1);
  });
});

describe('fieldAdvice — what runs at all', () => {
  it('runs only the families it was asked for', () => {
    const only = advice({ families: ['frost'] });
    expect(only.every((r) => r.family === 'frost')).toBe(true);
  });

  it('runs nothing when every family is off', () => {
    expect(advice({ families: [] })).toEqual([]);
  });

  it('covers all four when asked for all four', () => {
    const all = advice({
      past: run(14 * 24, { precip: 0.3 }),
      days: [day('2026-04-20', 0), day('2026-04-21', 0), day('2026-04-22', 0)],
      families: ADVICE_FAMILIES,
      tSum: 200,
    });
    expect(new Set(all.map((r) => r.family)).size).toBe(4);
  });
});

describe('reading a set as a whole', () => {
  const set = [
    { id: 'a', level: 0 }, { id: 'b', level: 2 }, { id: 'c', level: 1 },
  ] as AdviceReading[];

  it('takes the worst level as the location\'s own', () => {
    expect(adviceLevel(set)).toBe(2);
    expect(adviceLevel([])).toBe(0);
  });

  it('puts what is shut above what is merely worth knowing', () => {
    expect(byUrgency(set).map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
});
