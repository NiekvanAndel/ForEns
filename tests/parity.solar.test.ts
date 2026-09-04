/**
 * Parity: core/solar against index.html.
 *
 * The web app reads the UTC offset from `S._utcOffset`; the port takes it as an
 * argument. Every case here builds an oracle pinned to the same offset it passes
 * to the port, so the two are compared under identical conditions.
 */
import { describe, it, expect } from 'vitest';
import { loadOracle } from './oracle';
import {
  getSunriseSunset,
  sunMinutesInHour,
  isHourDay,
  solarPos,
  computeMethod6Sun,
} from '../core/solar';

const SOLAR_FNS = [
  'getSunriseSunset',
  'sunMinutesInHour',
  'isHourDay',
  'solarPos',
  '_m6median',
  'computeMethod6Sun',
] as const;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Latitudes spanning the tropics to inside the polar circles, so the midnight-sun
 *  and polar-night branches are actually exercised. */
const LATS = [0, 23.5, 51.6978, 60, 66.6, 71, -33.9, -78];
const DATES = ['2026-01-15', '2026-03-21', '2026-06-21', '2026-09-23', '2026-12-21'];
/** CET and CEST, the offsets the Dutch app actually sees, plus two far-away ones. */
const OFFSETS = [0, 3600, 7200, -28800, 19800];

describe('getSunriseSunset', () => {
  it('matches across latitudes and dates, including polar cases', () => {
    const O = loadOracle(SOLAR_FNS);
    for (const lat of LATS) {
      for (const date of DATES) {
        expect(getSunriseSunset(date, lat)).toEqual(O.getSunriseSunset(date, lat));
      }
    }
  });
});

describe('sunMinutesInHour', () => {
  it('matches for every hour of the day, at each offset', () => {
    for (const offset of OFFSETS) {
      const O = loadOracle(SOLAR_FNS, { utcOffsetSec: offset });
      for (const lat of LATS) {
        for (const date of DATES) {
          for (let h = 0; h < 24; h++) {
            const t = `${date}T${String(h).padStart(2, '0')}:00`;
            expect(sunMinutesInHour(t, lat, offset)).toEqual(O.sunMinutesInHour(t, lat));
          }
        }
      }
    }
  });
});

describe('isHourDay', () => {
  it('matches for every hour of the day, at each offset', () => {
    for (const offset of OFFSETS) {
      const O = loadOracle(SOLAR_FNS, { utcOffsetSec: offset });
      for (const lat of LATS) {
        for (const date of DATES) {
          for (let h = 0; h < 24; h++) {
            const t = `${date}T${String(h).padStart(2, '0')}:00`;
            expect(isHourDay(t, lat, offset)).toEqual(O.isHourDay(t, lat));
          }
        }
      }
    }
  });
});

describe('solarPos', () => {
  it('matches across random timestamps and locations', () => {
    const O = loadOracle(SOLAR_FNS);
    const rand = rng(31337);
    for (let i = 0; i < 1000; i++) {
      const utcMs = Date.UTC(2026, 0, 1) + Math.floor(rand() * 365 * 86400000);
      const lat = rand() * 180 - 90;
      const lon = rand() * 360 - 180;
      expect(solarPos(utcMs, lat, lon)).toEqual(O.solarPos(utcMs, lat, lon));
    }
  });
});

/** Build an hourly block shaped like an Open-Meteo response. */
function hourlyFixture(rand: () => number, days: number, offsetSec: number, opts: {
  cirrusOnly?: boolean;
  gaps?: boolean;
} = {}) {
  const time: string[] = [];
  const low: (number | null)[] = [];
  const mid: (number | null)[] = [];
  const high: (number | null)[] = [];
  const swr: (number | null)[] = [];
  const start = Date.UTC(2026, 5, 1) + offsetSec * 1000;
  for (let i = 0; i < days * 24; i++) {
    const d = new Date(start + i * 3600000);
    time.push(d.toISOString().slice(0, 16));
    if (opts.gaps && rand() < 0.08) {
      low.push(null); mid.push(null); high.push(null); swr.push(null);
      continue;
    }
    if (opts.cirrusOnly) {
      // Low/mid clear and high cloud present — the sampling branch for opacity.
      low.push(rand() * 8);
      mid.push(rand() * 8);
      high.push(20 + rand() * 70);
    } else {
      low.push(rand() * 100);
      mid.push(rand() * 100);
      high.push(rand() * 100);
    }
    const hour = d.getUTCHours();
    const daylight = hour > 4 && hour < 20;
    swr.push(daylight ? rand() * 800 : rand() < 0.5 ? 0 : null);
  }
  return {
    time,
    cloud_cover_low: low,
    cloud_cover_mid: mid,
    cloud_cover_high: high,
    shortwave_radiation: swr,
  };
}

describe('computeMethod6Sun', () => {
  const cases: [string, Parameters<typeof hourlyFixture>[3]][] = [
    ['mixed cloud', {}],
    ['cirrus-only, so opacity is derived from radiation', { cirrusOnly: true }],
    ['with gaps in the hourly series', { gaps: true }],
    ['cirrus-only with gaps', { cirrusOnly: true, gaps: true }],
  ];

  for (const [label, opts] of cases) {
    it(`matches — ${label}`, () => {
      for (const offset of [0, 3600, 7200]) {
        const O = loadOracle(SOLAR_FNS, { utcOffsetSec: offset });
        const rand = rng(8080 + offset);
        for (const lat of [51.6978, 60, 23.5]) {
          const H = hourlyFixture(rand, 5, offset, opts);
          const lon = 5.3037;
          expect(computeMethod6Sun(H, lat, lon, offset)).toEqual(
            O.computeMethod6Sun(H, lat, lon, offset)
          );
        }
      }
    });
  }

  it('matches when cloud layers are missing entirely', () => {
    const O = loadOracle(SOLAR_FNS, { utcOffsetSec: 3600 });
    const H = { time: ['2026-06-01T00:00'], shortwave_radiation: [0] };
    expect(computeMethod6Sun(H, 51.7, 5.3, 3600)).toEqual(O.computeMethod6Sun(H, 51.7, 5.3, 3600));
    expect(computeMethod6Sun(null, 51.7, 5.3, 3600)).toEqual(O.computeMethod6Sun(null, 51.7, 5.3, 3600));
  });
});
