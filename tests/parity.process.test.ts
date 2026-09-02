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
  // The daily icon is the mode of the hours as drawn, so the sunny-period rule is
  // part of `processAll` now and has to be in the sandbox with it.
  'sunnyWmo',
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
    consts: ['SUNNY_FRACTION', 'DRY_TRACE_MM'],
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

/**
 * The daily icon reads the hours as they are drawn.
 *
 * A day whose every hour reads as sunshine must not be labelled cloudy because the
 * codes underneath say otherwise — and a day with rain in it must be labelled
 * exactly as it was before, whatever the sun did. Both apps have to make the same
 * call, so each case is checked against index.html as well as pinned outright.
 */
describe('daily icon after the sunny-period rule', () => {
  /** Overcast codes over a cloudless, brightly lit day: the codes and the sunshine
   *  disagree, which is the only situation where the rule changes anything. */
  function sunlitButCloudyCoded(seed: number, dayPrecipMm: number) {
    const f = buildFixtures(seed);
    f.ecmwfHourly.hourly.weather_code = f.ecmwfHourly.hourly.time.map(() => 3);
    f.ecmwfHourlyExt.hourly.weather_code = f.ecmwfHourlyExt.hourly.time.map(() => 3);
    // No cloud in any layer and full radiation, so method 6 reports a full hour of
    // sunshine for every daylight hour.
    const ih = f.iJ.hourly as Record<string, unknown[]>;
    for (const k of ['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high']) {
      ih[k] = (ih.time as string[]).map(() => 0);
    }
    ih.shortwave_radiation = (ih.time as string[]).map(() => 900);
    const daily = f.iJ.daily as Record<string, unknown[]>;
    daily.precipitation_sum = (daily.time as string[]).map(() => dayPrecipMm);
    return f;
  }

  /** Day 2 onward is drawn from the ECMWF codes, clear of the HARMONIE days. */
  const ICON_DAY = 3;

  it('gives a dry, sunlit day the sun even when its codes say overcast', () => {
    const { expected, actual } = run(sunlitButCloudyCoded(4242, 0));
    expect(actual!.days[ICON_DAY]!.dayIcon).toBe(0);
    expect(actual).toEqual(expected);
  });

  it('leaves the same day overcast once rain is forecast', () => {
    // The only difference from the case above is the day's precipitation, so this
    // pins the fallback rather than some other property of the fixture.
    const { expected, actual } = run(sunlitButCloudyCoded(4242, 2));
    expect(actual!.days[ICON_DAY]!.dayIcon).toBe(3);
    expect(actual).toEqual(expected);
  });

  it('falls back on any precipitation the model actually reports', () => {
    // The daily total is carried rounded to a tenth, so the trace threshold that
    // matters for a single hour cannot resolve anything finer here: 0.05 mm rounds
    // up to 0.1 and reads as a wet day, 0.04 rounds to nothing and reads as dry.
    // The effective rule at day level is therefore "any precipitation at all, to
    // the model's own reported precision" — which is the rule as specified.
    const reported = run(sunlitButCloudyCoded(4242, 0.05));
    const belowPrecision = run(sunlitButCloudyCoded(4242, 0.04));
    expect(reported.actual!.days[ICON_DAY]!.dayIcon).toBe(3);
    expect(belowPrecision.actual!.days[ICON_DAY]!.dayIcon).toBe(0);
    expect(reported.actual).toEqual(reported.expected);
    expect(belowPrecision.actual).toEqual(belowPrecision.expected);
  });
});
