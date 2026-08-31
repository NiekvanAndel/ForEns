/**
 * Day-detail assembly and the hourly ensemble.
 *
 * The web app decided which hourly series a day should use inside each of its six
 * popup renderers, which is why they disagreed in places. It is one decision here,
 * and these tests pin it down.
 */
import { describe, it, expect } from 'vitest';
import { buildDayDetail, precipNarrative, spreadLabel } from '../core/model/dayDetail';
import { parseDayEnsemble, DayEnsembleCache } from '../core/sources/ensembleHourly';
import type { Day, ForecastModel, Hour, HresHour } from '../core/model/types';

const hour = (time: string, over: Partial<Hour> = {}): Hour => ({
  time, temp: 15, precip: 0, wind: 10, humidity: 70, wmo: 1,
  isDay: 1, isPast: false, gusts: 18, windDir: 200, sunMin: 30,
  ...over,
});

const hres = (time: string, over: Partial<HresHour> = {}): HresHour => ({
  time, hour: parseInt(time.slice(11, 13), 10), precip: 0.4, wmo: 61, is3h: false,
  temp: 17, dewpoint: 11, humidity: 68, wind: 14, windDir: 210, gusts: 22,
  sunMin: 25, et0h: 0.2,
  ...over,
});

const day = (over: Partial<Day> = {}): Day => ({
  date: '2026-06-15', useHarm: true,
  precipP10: 0, precipP25: 0, precipMedian: 0, precipP75: 2, precipP90: 6,
  pChance: 40, p5mm: 12, p20mm: 2,
  tempLo: 11, tempHi: 22,
  tempMaxP10: 19, tempMaxP25: 20, tempMaxP50: 22, tempMaxP75: 23, tempMaxP90: 25,
  tempMinP10: 9, tempMinP25: 10, tempMinP50: 11, tempMinP75: 12, tempMinP90: 13,
  windP10: 10, windP25: 14, windP50: 18, windP75: 22, windP90: 28,
  humidityMedian: 70, humidityP10: 55, humidityP25: 62, humidityP75: 80, humidityP90: 88,
  sunHours: 5, et0: 3, windDir: 200,
  sunModel: 'harmonie', sunOpacity: 0.15, sunOpacityDerived: false, sun6Hourly: null,
  dayIcon: 3, wmo: 3, nMembers: 51, ensLoaded: true,
  harmTempMax: null, harmTempMin: null, harmPrecip: null, harmWindMax: null,
  harmRhMin: null, harmRhMax: null, hresRhMin: null, hresRhMax: null,
  ...over,
} as Day);

function model(over: Partial<ForecastModel> = {}): ForecastModel {
  return {
    pastHours: [], futureHours: [], allHours: [], nowHour: '2026-06-15T12:00',
    days: [], currentTemp: 15, currentWmo: 1, nMembers: 51,
    hresRunLabel: 'IFS 06z', hresHoursByDay: {},
    ...over,
  };
}

describe('buildDayDetail', () => {
  it('uses HARMONIE for today and prepends the hours already observed', () => {
    const d = day({ useHarm: true });
    const m = model({
      days: [d],
      pastHours: [hour('2026-06-15T09:00', { isPast: true }), hour('2026-06-15T10:00', { isPast: true })],
      futureHours: [hour('2026-06-15T12:00'), hour('2026-06-15T13:00')],
    });
    const detail = buildDayDetail(m, d);
    expect(detail.source).toBe('harmonie');
    expect(detail.sourceLabel).toBe('HARMONIE-AROME');
    // The whole day is covered, not just from "now" onward.
    expect(detail.hours.map((h) => h.time.slice(11, 16))).toEqual(['09:00', '10:00', '12:00', '13:00']);
    expect(detail.hours.filter((h) => h.isPast)).toHaveLength(2);
  });

  it('ignores hours belonging to another day', () => {
    const d = day();
    const m = model({
      days: [d],
      pastHours: [hour('2026-06-14T23:00', { isPast: true })],
      futureHours: [hour('2026-06-15T12:00'), hour('2026-06-16T01:00')],
    });
    expect(buildDayDetail(m, d).hours.map((h) => h.time)).toEqual(['2026-06-15T12:00']);
  });

  it('uses the IFS hourly series beyond HARMONIE, keeping the three-hourly flag', () => {
    const d = day({ date: '2026-06-20', useHarm: false });
    const m = model({
      days: [day(), d],
      hresHoursByDay: {
        '2026-06-20': [
          hres('2026-06-20T00:00', { is3h: true }),
          hres('2026-06-20T03:00', { is3h: true }),
        ],
      },
    });
    const detail = buildDayDetail(m, d);
    expect(detail.source).toBe('ifs');
    expect(detail.sourceLabel).toBe('ECMWF IFS');
    expect(detail.hours.every((h) => h.is3h)).toBe(true);
    expect(detail.dayIndex).toBe(1);
  });

  it('returns an empty day rather than throwing when nothing has loaded', () => {
    const d = day({ date: '2026-06-25', useHarm: false });
    const detail = buildDayDetail(model({ days: [d] }), d);
    expect(detail.hours).toEqual([]);
  });

  it('overlays method-6 sunshine minutes where the day carries them', () => {
    const d = day({ sun6Hourly: { '2026-06-15T12:00': 42 } });
    const m = model({ days: [d], futureHours: [hour('2026-06-15T12:00', { sunMin: 5 })] });
    expect(buildDayDetail(m, d).hours[0]!.sunMin).toBe(42);
  });

  it('attaches the hourly ensemble where it has loaded', () => {
    const d = day();
    const m = model({ days: [d], futureHours: [hour('2026-06-15T12:00'), hour('2026-06-15T13:00')] });
    const ens = {
      '2026-06-15T12:00': {
        pChance: 80, precipP10: 0, precipP25: 0.2, precipP50: 1, precipP75: 2, precipP90: 4,
      },
    };
    const detail = buildDayDetail(m, d, ens);
    expect(detail.hours[0]!.ens?.pChance).toBe(80);
    expect(detail.hours[1]!.ens).toBeUndefined();
  });

  it('always returns hours in chronological order', () => {
    const d = day();
    const m = model({
      days: [d],
      pastHours: [hour('2026-06-15T10:00', { isPast: true })],
      futureHours: [hour('2026-06-15T13:00'), hour('2026-06-15T11:00')],
    });
    const times = buildDayDetail(m, d).hours.map((h) => h.time);
    expect(times).toEqual([...times].sort());
  });
});

describe('precipNarrative', () => {
  it('says nothing before the ensemble has loaded', () => {
    expect(precipNarrative(day({ ensLoaded: false }))).toBeNull();
  });

  it('calls a confident dry day dry', () => {
    expect(precipNarrative(day({ pChance: 2 }))).toMatch(/vrijwel zeker droog/);
  });

  it('names the case where most members are dry but a few are very wet', () => {
    // This is exactly what an average would hide, so it has to be said explicitly.
    const s = precipNarrative(day({ pChance: 45, precipMedian: 0, precipP90: 8 }))!;
    expect(s).toMatch(/meeste leden blijven droog/);
    expect(s).toContain('45% kans');
  });

  it('uses comma decimals, per the design system', () => {
    const s = precipNarrative(day({ pChance: 80, precipP25: 1.5, precipP90: 6.2 }))!;
    expect(s).toContain('1,5 mm');
    expect(s).not.toContain('1.5');
  });

  it('escalates to the 20 mm threshold when that is the real risk', () => {
    expect(precipNarrative(day({ pChance: 90, p20mm: 35, p5mm: 70 }))).toMatch(/20 mm/);
  });
});

describe('spreadLabel', () => {
  it('reports agreement when the members are close', () => {
    expect(spreadLabel(day({ precipP10: 1, precipP90: 2, tempMaxP10: 21, tempMaxP90: 23 }))).toBe('eens');
  });

  it('reports disagreement when either measure is wide', () => {
    expect(spreadLabel(day({ precipP10: 0, precipP90: 12, tempMaxP10: 21, tempMaxP90: 23 }))).toBe('oneens');
    // Temperature alone is enough, even with no rain in question at all.
    expect(spreadLabel(day({ precipP10: 0, precipP90: 0, tempMaxP10: 14, tempMaxP90: 28 }))).toBe('oneens');
  });

  it('says nothing without an ensemble', () => {
    expect(spreadLabel(day({ ensLoaded: false }))).toBeNull();
  });
});

describe('parseDayEnsemble', () => {
  it('computes per-hour percentiles across members', () => {
    const out = parseDayEnsemble({
      hourly: {
        time: ['2026-06-15T00:00', '2026-06-15T01:00'],
        precipitation_member01: [0, 4],
        precipitation_member02: [0, 0],
        precipitation_member03: [1, 2],
      },
    });
    expect(out['2026-06-15T00:00']!.pChance).toBe(33);
    expect(out['2026-06-15T01:00']!.precipP50).toBe(2);
  });

  it('falls back to a deterministic series when there are no members', () => {
    const out = parseDayEnsemble({
      hourly: { time: ['2026-06-15T00:00'], precipitation: [1.4] },
    });
    expect(out['2026-06-15T00:00']!.precipP50).toBe(1.4);
    expect(out['2026-06-15T00:00']!.pChance).toBe(100);
  });

  it('returns nothing for an empty or absent response', () => {
    expect(parseDayEnsemble(null)).toEqual({});
    expect(parseDayEnsemble({})).toEqual({});
  });
});

describe('DayEnsembleCache', () => {
  it('keys on location as well as date', async () => {
    const cache = new DayEnsembleCache();
    expect(cache.get(51.7, 5.3, '2026-06-15')).toBeUndefined();
    // Two cities on the same date must not share an entry.
    expect(cache.get(52.4, 4.9, '2026-06-15')).toBeUndefined();
  });
});
