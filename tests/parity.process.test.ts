/**
 * Parity: core/model/process against index.html's processAll.
 *
 * processAll is the widest surface in the app — six optional inputs, fourteen days,
 * and a per-day object with sixty-odd fields — so this compares whole structures
 * rather than spot values.
 */
import { describe, it, expect } from 'vitest';
import { loadOracle } from './oracle';
import { buildFixtures, BASE_MS } from './fixtures';
import { processAll } from '../core/model/process';
import type { ProcessContext } from '../core/model/types';

const PROCESS_FNS = [
  'r1', 'pct', 'pge',
  'getSunriseSunset', 'sunMinutesInHour', 'isHourDay', 'solarPos',
  '_m6median', 'computeMethod6Sun',
  'processAll',
] as const;

const LAT = 51.6978;
const LON = 5.3037;
const OFFSET = 7200;
/** Pinned so the IFS run label ("IFS 12z") is deterministic on both sides. */
const NOW_MS = BASE_MS + 14.5 * 3600000;

function run(
  f: ReturnType<typeof buildFixtures>,
  o: { useHarmonie?: boolean; harmFailed?: boolean; withIcons?: boolean; noHarm?: boolean; noObs?: boolean } = {}
) {
  const useHarmonie = o.useHarmonie ?? true;
  const harmFailed = o.harmFailed ?? false;
  const withIcons = o.withIcons ?? true;

  const oJ = o.noObs ? null : f.oJ;
  const hJ = o.noHarm ? null : f.hJ;

  const oracle = loadOracle(PROCESS_FNS, {
    utcOffsetSec: OFFSET,
    nowMs: NOW_MS,
    S: {
      lat: LAT,
      lon: LON,
      harmFailed,
      _ecmwfHourly: withIcons ? f.ecmwfHourly : null,
      _ecmwfHourlyExt: withIcons ? f.ecmwfHourlyExt : null,
      data: null,
    },
    PREFS: { useHarmonie },
  });

  const expected = oracle.processAll(oJ, hJ, f.eJ, f.sJ, f.iJ, f.ihJ);

  const ctx: ProcessContext = {
    lat: LAT,
    lon: LON,
    useHarmonie,
    harmFailed,
    ecmwfHourly: withIcons ? (f.ecmwfHourly as any) : null,
    ecmwfHourlyExt: withIcons ? (f.ecmwfHourlyExt as any) : null,
    now: new Date(NOW_MS),
  };
  const full = processAll(oJ as any, hJ as any, f.eJ as any, f.sJ as any, f.iJ as any, f.ihJ as any, ctx);

  return { expected, actual: comparable(full), full };
}

/**
 * The port's `hresHoursByDay` carries the whole IFS hour — temperature, wind,
 * humidity, sunshine — where the web app's carried only millimetres and a weather
 * code, because the web app re-fetched the rest per popup instead. That is an
 * addition, not a divergence, so it is projected away before comparing rather than
 * weakening the comparison to a subset match. `keeps the whole IFS hour` below
 * asserts the extension is actually populated.
 */
function comparable(m: ReturnType<typeof processAll>): ReturnType<typeof processAll> {
  if (!m) return m;
  const hresHoursByDay = Object.fromEntries(
    Object.entries(m.hresHoursByDay).map(([date, hours]) => [
      date,
      hours.map(({ time, hour, precip, wmo, is3h }) => ({ time, hour, precip, wmo, is3h })),
    ])
  );
  return { ...m, hresHoursByDay } as ReturnType<typeof processAll>;
}

describe('processAll', () => {
  it('matches on a complete set of sources', () => {
    const f = buildFixtures(1001);
    const { expected, actual } = run(f);
    expect(actual).toEqual(expected);
    // Guard against a vacuous pass: the fixture must actually produce days and hours.
    expect(actual!.days.length).toBeGreaterThan(6);
    expect(actual!.futureHours.length).toBeGreaterThan(20);
    expect(actual!.pastHours.length).toBe(12);
    expect(actual!.nMembers).toBe(51);
  });

  it('matches with gaps throughout every series', () => {
    const f = buildFixtures(2002, { gaps: true });
    const { expected, actual } = run(f);
    expect(actual).toEqual(expected);
  });

  it('matches before the ensemble has loaded', () => {
    const f = buildFixtures(3003, { members: 0 });
    const { expected, actual } = run(f);
    expect(actual).toEqual(expected);
    expect(actual!.days.some((d) => !d.ensLoaded)).toBe(true);
  });

  it('matches when ENS is shorter than the IFS horizon', () => {
    const f = buildFixtures(4004, { ensDays: 5, ifsDays: 14 });
    const { expected, actual } = run(f);
    expect(actual).toEqual(expected);
  });

  it('matches with HARMONIE disabled in preferences', () => {
    const f = buildFixtures(5005);
    const { expected, actual } = run(f, { useHarmonie: false });
    expect(actual).toEqual(expected);
    expect(actual!.days.every((d) => !d.useHarm)).toBe(true);
  });

  it('matches when the HARMONIE fetch failed', () => {
    const f = buildFixtures(6006);
    const { expected, actual } = run(f, { harmFailed: true });
    expect(actual).toEqual(expected);
  });

  it('matches with no HARMONIE response at all', () => {
    const f = buildFixtures(7007);
    const { expected, actual } = run(f, { noHarm: true });
    expect(actual).toEqual(expected);
  });

  it('matches with no observations, so there is no history', () => {
    const f = buildFixtures(8008);
    const { expected, actual } = run(f, { noObs: true });
    expect(actual).toEqual(expected);
    expect(actual!.pastHours.length).toBe(0);
  });

  it('matches before the ECMWF icon calls have landed', () => {
    const f = buildFixtures(9009);
    const { expected, actual } = run(f, { withIcons: false });
    expect(actual).toEqual(expected);
  });

  it('returns null when neither observations nor hourly are present', () => {
    const f = buildFixtures(1111);
    const ctx: ProcessContext = {
      lat: LAT, lon: LON, useHarmonie: true, harmFailed: false, now: new Date(NOW_MS),
    };
    expect(processAll(null, null, f.eJ as any, f.sJ as any, f.iJ as any, f.ihJ as any, ctx)).toBeNull();
  });

  it('matches across many random fixtures', () => {
    for (let seed = 100; seed < 130; seed++) {
      const f = buildFixtures(seed, { gaps: seed % 2 === 0 });
      const { expected, actual } = run(f, {
        useHarmonie: seed % 3 !== 0,
        harmFailed: seed % 5 === 0,
        withIcons: seed % 7 !== 0,
      });
      expect(actual, `seed ${seed}`).toEqual(expected);
    }
  });

  it('keeps the whole IFS hour, not only its millimetres', () => {
    // The web app fetched temperature, wind, humidity and sunshine separately in
    // each day popup, so its hresHoursByDay had none of them. The port reads one
    // call, which is what lets every section of a day sheet show the same hours.
    const f = buildFixtures(1313);
    const { full } = run(f);
    const hours = Object.values(full!.hresHoursByDay).flat();
    expect(hours.length).toBeGreaterThan(0);
    for (const field of ['temp', 'wind', 'windDir', 'gusts', 'humidity', 'sunMin', 'et0h'] as const) {
      expect(hours.some((h) => h[field] != null), field).toBe(true);
    }
    // Humidity is derived from the dew point where the response omits it.
    expect(hours.some((h) => h.humidity != null && h.humidity >= 0 && h.humidity <= 100)).toBe(true);
  });

  it('switches IFS hourly precipitation to three-hourly after 90 hours', () => {
    const f = buildFixtures(1212);
    const { actual } = run(f);
    const all = Object.values(actual!.hresHoursByDay).flat();
    const threeHourly = all.filter((h) => h.is3h);
    expect(threeHourly.length).toBeGreaterThan(0);
    expect(threeHourly.every((h) => h.hour % 3 === 0)).toBe(true);
  });
});
