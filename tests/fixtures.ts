/**
 * Synthetic Open-Meteo responses, shaped like the real ones.
 *
 * The point is coverage of the branches `processAll` actually has: missing sources,
 * gaps in a series, ensembles that have not loaded yet, the 90-hour switch from
 * hourly to three-hourly IFS precipitation, and days beyond the ENS horizon.
 */

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Local wall-clock stamps, `YYYY-MM-DDTHH:MM`, as timezone=auto returns. */
function hourStamps(startMs: number, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(new Date(startMs + i * 3600000).toISOString().slice(0, 16));
  }
  return out;
}

function dayStamps(startMs: number, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(new Date(startMs + i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

const NULL_RATE = 0.04;
const maybe = (rand: () => number, v: number, gaps: boolean) =>
  gaps && rand() < NULL_RATE ? null : v;

export interface FixtureOptions {
  gaps?: boolean;
  /** Number of ENS members; 0 means the ensemble has not loaded. */
  members?: number;
  /** Days of IFS deterministic data. */
  ifsDays?: number;
  /** Days of ENS data — shorter than ifsDays exercises the beyond-horizon path. */
  ensDays?: number;
  hourlyHours?: number;
}

/** Base timestamp: 2026-06-15T00:00Z, so the fixtures sit in a stable season. */
export const BASE_MS = Date.UTC(2026, 5, 15, 0, 0, 0);
/** "Now" inside the fixtures — 14:30 local on the first day. */
export const NOW_TIME = new Date(BASE_MS + 14.5 * 3600000).toISOString().slice(0, 16);

function hourlyBlock(rand: () => number, times: string[], gaps: boolean) {
  const n = times.length;
  const f = (scale: number, offset = 0) =>
    Array.from({ length: n }, () => maybe(rand, rand() * scale + offset, gaps));
  return {
    time: times,
    temperature_2m: f(25, -3),
    precipitation: Array.from({ length: n }, () =>
      maybe(rand, rand() < 0.6 ? 0 : rand() * 6, gaps)
    ),
    windspeed_10m: f(40),
    winddirection_10m: f(360),
    windgusts_10m: f(70),
    weathercode: Array.from({ length: n }, () =>
      maybe(rand, [0, 1, 2, 3, 45, 61, 63, 80, 95][Math.floor(rand() * 9)] as number, gaps)
    ),
    relativehumidity_2m: f(60, 40),
    cloudcover: f(100),
    dewpoint_2m: f(15, -2),
    apparent_temperature: f(25, -5),
    surface_pressure: f(40, 990),
    et0_fao_evapotranspiration: f(0.4),
    direct_normal_irradiance: f(900),
    cloud_cover_low: f(100),
    cloud_cover_mid: f(100),
    cloud_cover_high: f(100),
    shortwave_radiation: f(850),
    sunshine_duration: f(3600),
  };
}

export function buildFixtures(seed: number, opts: FixtureOptions = {}) {
  const {
    gaps = false,
    members = 51,
    ifsDays = 14,
    ensDays = 7,
    hourlyHours = 120,
  } = opts;
  const rand = rng(seed);

  const obsTimes = hourStamps(BASE_MS - 24 * 3600000, 48);
  const futureTimes = hourStamps(BASE_MS, hourlyHours);

  const oJ = {
    hourly: hourlyBlock(rand, obsTimes, gaps),
    current_weather: { time: NOW_TIME, temperature: 18.2, weathercode: 3 },
    utc_offset_seconds: 7200,
  };

  const hJ = {
    hourly: hourlyBlock(rand, futureTimes, gaps),
    current_weather: { time: NOW_TIME, temperature: 18.4, weathercode: 2 },
    utc_offset_seconds: 7200,
  };

  // ENS: one series per member, per daily field.
  const ensDates = dayStamps(BASE_MS, ensDays);
  const ensDaily: Record<string, unknown> = { time: ensDates };
  if (members > 0) {
    for (const [field, scale, offset] of [
      ['precipitation_sum', 12, 0],
      ['temperature_2m_max', 12, 14],
      ['temperature_2m_min', 8, 4],
      ['windspeed_10m_max', 45, 5],
    ] as const) {
      for (let m = 1; m <= members; m++) {
        const key = `${field}_member${String(m).padStart(2, '0')}`;
        ensDaily[key] = ensDates.map(() => maybe(rand, rand() * scale + offset, gaps));
      }
    }
  }
  const eJ = members > 0 ? { daily: ensDaily, utc_offset_seconds: 7200 } : null;

  // IFS deterministic daily, plus the hourly cloud fields method 6 needs.
  const ifsDates = dayStamps(BASE_MS, ifsDays);
  const ifsHourly = hourlyBlock(rand, hourStamps(BASE_MS, ifsDays * 24), gaps);
  const iJ = {
    daily: {
      time: ifsDates,
      temperature_2m_max: ifsDates.map(() => maybe(rand, rand() * 12 + 14, gaps)),
      temperature_2m_min: ifsDates.map(() => maybe(rand, rand() * 8 + 4, gaps)),
      precipitation_sum: ifsDates.map(() => maybe(rand, rand() * 10, gaps)),
      precipitation_probability_max: ifsDates.map(() => maybe(rand, Math.round(rand() * 100), gaps)),
      windspeed_10m_max: ifsDates.map(() => maybe(rand, rand() * 45 + 5, gaps)),
      winddirection_10m_dominant: ifsDates.map(() => maybe(rand, rand() * 360, gaps)),
      weather_code: ifsDates.map(() => maybe(rand, [0, 2, 3, 61, 80, 95][Math.floor(rand() * 6)] as number, gaps)),
      dewpoint_2m_max: ifsDates.map(() => maybe(rand, rand() * 12 + 2, gaps)),
      dewpoint_2m_min: ifsDates.map(() => maybe(rand, rand() * 8 - 2, gaps)),
      sunshine_duration: ifsDates.map(() => maybe(rand, rand() * 50000, gaps)),
      et0_fao_evapotranspiration: ifsDates.map(() => maybe(rand, rand() * 5, gaps)),
    },
    hourly: ifsHourly,
    generationtime_ms: 12.5,
    utc_offset_seconds: 7200,
  };

  const sJ = iJ; // sunshine and ET0 arrive inside the IFS call

  // IFS hourly precipitation — long enough to cross the 90-hour resolution switch.
  const ihTimes = hourStamps(BASE_MS, 24 * ifsDays);
  const ihJ = {
    hourly: {
      time: ihTimes,
      precipitation: ihTimes.map(() => maybe(rand, rand() < 0.6 ? 0 : rand() * 5, gaps)),
      weather_code: ihTimes.map(() => maybe(rand, [0, 3, 61, 80][Math.floor(rand() * 4)] as number, gaps)),
      temperature_2m: ihTimes.map(() => maybe(rand, rand() * 20 + 2, gaps)),
      dewpoint_2m: ihTimes.map(() => maybe(rand, rand() * 12, gaps)),
    },
    utc_offset_seconds: 7200,
  };

  // The separate ECMWF weather-code call used for day icons.
  const iconTimes = hourStamps(BASE_MS, 24 * 7);
  const ecmwfHourly = {
    hourly: {
      time: iconTimes,
      weather_code: iconTimes.map(() => maybe(rand, [0, 1, 2, 3, 61, 80, 95][Math.floor(rand() * 7)] as number, gaps)),
    },
  };
  const extTimes = hourStamps(BASE_MS, 24 * 14);
  const ecmwfHourlyExt = {
    hourly: {
      time: extTimes,
      weather_code: extTimes.map(() => maybe(rand, [0, 2, 3, 63, 81][Math.floor(rand() * 5)] as number, gaps)),
    },
  };

  return { oJ, hJ, eJ, sJ, iJ, ihJ, ecmwfHourly, ecmwfHourlyExt };
}
