/**
 * The 'Actueel' grid and the 'Grafiek' series.
 *
 * Both are places where a wrong answer looks like a right one. A tile can print a
 * station's wind in the wrong unit and still read as a plausible wind speed; a chart
 * can run a forecast on into a measured line and still read as a chart. So the two
 * things pinned hardest here are which source a value came from, and whether it was
 * converted on the way.
 */
import { describe, it, expect } from 'vitest';
import { dashboardTiles, modelTiles, tileKind, type TileLabels } from '../core/model/tiles';
import { buildSeries, daySpan, forecastHorizon, hourKeys } from '../core/model/series';
import type { ForecastModel, Hour } from '../core/model/types';
import type { MeasuredHour } from '../core/sources/agroexact';

const labels: TileLabels = {
  temperature: 'Temperatuur', humidity: 'Luchtvochtigheid',
  windSpeed: 'Windsnelheid', windGust: 'Windstoot', windDirection: 'Windrichting',
  gustMax: 'Max. windstoot', rain: 'Neerslag',
  tempMax: 'Max. temperatuur', tempMin: 'Min. temperatuur',
  now: 'nu', today: 'vandaag',
  last6h: 'laatste 6 uur', last12h: 'laatste 12 uur', last24h: 'laatste 24 uur',
};

const hour = (time: string, over: Partial<Hour> = {}): Hour => ({
  time, temp: 10, tempExact: 10, precip: 0, wind: 12, windExact: 12, humidity: 70,
  wmo: 3, isDay: 1, isPast: true, gusts: 20, windDir: 180, dewpoint: 5, ...over,
});

const model = (over: Partial<ForecastModel> = {}): ForecastModel => {
  const past = over.pastHours ?? [hour('2026-06-15T10:00'), hour('2026-06-15T11:00')];
  const future = over.futureHours ?? [hour('2026-06-15T12:00', { isPast: false, temp: 15, tempExact: 15.4 })];
  return {
    pastHours: past, futureHours: future, allHours: [...past, ...future],
    nowHour: '2026-06-15T12:00', days: [], currentTemp: 15, currentWmo: 3,
    nMembers: 0, hresRunLabel: null, hresHoursByDay: {}, ...over,
  };
};

const measured = (time: string, over: Partial<MeasuredHour> = {}): MeasuredHour => ({
  time, temp: 20, tempMin: 19, tempMax: 21, humidity: 60, dewpoint: 8,
  wind: 8, gusts: 15, windDir: 90, precip: 0, ...over,
});

describe('tileKind', () => {
  it('reads a direction as a compass point, not as its unit', () => {
    expect(tileKind('wind_direction', '°')).toBe('direction');
    // "°" is also the temperature unit, so the attribute has to decide.
    expect(tileKind('temperature_150', '°C')).toBe('temp');
  });

  it('classifies by what the quantity is, not by how the API writes it', () => {
    expect(tileKind('windspeed', 'm/s')).toBe('wind');
    expect(tileKind('gust_max', 'm/s')).toBe('wind');
    expect(tileKind('precipitation', 'mm')).toBe('mm');
    expect(tileKind('humidity_150', '%')).toBe('percent');
    expect(tileKind('global_radiation', 'J/cm²')).toBe('raw');
  });
});

describe('dashboardTiles', () => {
  it("converts the API's metres per second into the app's km/h, once", () => {
    const tile = dashboardTiles([
      { id: 4, title: 'Wind', attribute: 'windspeed', timeLabel: 'nu', unit: 'm/s', value: 10 },
    ])[0]!;
    expect(tile.value).toBe(36);
    expect(tile.kind).toBe('wind');
    expect(tile.measured).toBe(true);
  });

  it('leaves every other quantity exactly as the API sent it', () => {
    const temp = dashboardTiles([
      { id: 1, title: 'Temp', attribute: 'temperature_150', timeLabel: 'nu', unit: '°C', value: 17.4 },
    ])[0]!;
    expect(temp.value).toBe(17.4);
  });

  it('keeps a block with no answer, so the grid does not reflow', () => {
    const tile = dashboardTiles([
      { id: 9, title: 'Straling', attribute: 'global_radiation', timeLabel: 'vandaag', unit: 'J/cm²', value: null },
    ])[0]!;
    expect(tile.value).toBeNull();
  });
});

describe('modelTiles', () => {
  it('marks nothing as measured on a location with no station', () => {
    const tiles = modelTiles(model(), labels);
    expect(tiles.every((t) => !t.measured)).toBe(true);
  });

  it("prefers the station's reading and says which figures it covers", () => {
    const tiles = modelTiles(
      model({
        station: {
          id: 'st1', name: 'Rosmalen',
          // A rain gauge: rainfall and temperature, no wind.
          current: {
            time: '2026-06-15T12:00', measTime: '2026-06-15T12:10:00Z',
            temp: 21.3, humidity: null, dewpoint: null, wind: null, gusts: null,
            windDir: null, precip: 0.4,
          },
        },
      }),
      labels
    );
    const byId = new Map(tiles.map((t) => [t.id, t]));
    expect(byId.get('temp')?.value).toBe(21.3);
    expect(byId.get('temp')?.measured).toBe(true);
    // Nothing measured the wind, so the model answers and the tile does not claim
    // otherwise.
    expect(byId.get('wind')?.value).toBe(12);
    expect(byId.get('wind')?.measured).toBe(false);
  });

  it('summarises the last 24 hours rather than the rest of today', () => {
    const tiles = modelTiles(
      model({
        pastHours: [
          hour('2026-06-15T10:00', { tempExact: 8, precip: 1.2 }),
          hour('2026-06-15T11:00', { tempExact: 12, precip: 0.3 }),
        ],
      }),
      labels
    );
    const byId = new Map(tiles.map((t) => [t.id, t]));
    expect(byId.get('temp-min')?.value).toBe(8);
    expect(byId.get('rain-24h')?.value).toBe(1.5);
  });

  it('is the twelve blocks the client asked for, in their order', () => {
    expect(modelTiles(model(), labels).map((t) => t.id)).toEqual([
      'temp', 'humidity', 'wind', 'gust', 'wind-dir', 'gust-max',
      'rain-6h', 'rain-12h', 'rain-today', 'rain-24h', 'temp-max', 'temp-min',
    ]);
  });

  it('tells a rolling window from a calendar day', () => {
    const tiles = modelTiles(
      model({
        pastHours: [
          // Yesterday evening: inside the rolling 24 hours, outside "today".
          hour('2026-06-14T22:00', { precip: 5, gusts: 90 }),
          hour('2026-06-15T02:00', { precip: 1, gusts: 40 }),
          hour('2026-06-15T11:00', { precip: 2, gusts: 30 }),
        ],
      }),
      labels
    );
    const byId = new Map(tiles.map((t) => [t.id, t]));
    expect(byId.get('rain-24h')?.value).toBe(8);
    expect(byId.get('rain-today')?.value).toBe(3);
    // The 90 km/h gust was yesterday's, so today's peak is not it.
    expect(byId.get('gust-max')?.value).toBe(40);
  });

  it('sums each rolling rainfall window over its own trailing hours', () => {
    const pastHours = Array.from({ length: 24 }, (_, i) =>
      hour(`2026-06-15T${String(i).padStart(2, '0')}:00`, { precip: 1 })
    );
    const byId = new Map(
      modelTiles(model({ pastHours, nowHour: '2026-06-15T23:00' }), labels).map((t) => [t.id, t])
    );
    expect(byId.get('rain-6h')?.value).toBe(6);
    expect(byId.get('rain-12h')?.value).toBe(12);
    expect(byId.get('rain-24h')?.value).toBe(24);
  });

  it('reads a wind direction as a bearing the page can turn into a compass point', () => {
    const byId = new Map(modelTiles(model(), labels).map((t) => [t.id, t]));
    expect(byId.get('wind-dir')?.kind).toBe('direction');
    expect(byId.get('wind-dir')?.value).toBe(180);
  });
});

describe('hourKeys and daySpan', () => {
  it('runs from the first hour of the first day to the last of the last', () => {
    const keys = hourKeys('2026-06-15', '2026-06-16');
    expect(keys).toHaveLength(48);
    expect(keys[0]).toBe('2026-06-15T00:00');
    expect(keys[47]).toBe('2026-06-16T23:00');
  });

  it('counts both ends of the window', () => {
    expect(daySpan('2026-06-15', '2026-06-15')).toBe(1);
    expect(daySpan('2026-06-01', '2026-06-30')).toBe(30);
  });

  it('gives nothing back for a window that runs backwards', () => {
    expect(hourKeys('2026-06-16', '2026-06-15')).toEqual([]);
  });
});

describe('buildSeries', () => {
  const window = { from: '2026-06-15', to: '2026-06-15' };

  it('prefers the measurement and marks it as one', () => {
    const s = buildSeries({
      key: 'temp', ...window,
      measured: [measured('2026-06-15T10:00', { temp: 20 })],
      model: model(),
    });
    const at10 = s.samples.find((x) => x.key === '2026-06-15T10:00');
    expect(at10?.value).toBe(20);
    expect(at10?.measured).toBe(true);
    expect(s.anyMeasured).toBe(true);
  });

  it('falls back to the model per quantity, not per hour', () => {
    const s = buildSeries({
      key: 'wind', ...window,
      // A rain gauge: it reported the hour, but has no anemometer on it.
      measured: [measured('2026-06-15T10:00', { wind: null, gusts: null })],
      model: model(),
    });
    const at10 = s.samples.find((x) => x.key === '2026-06-15T10:00');
    expect(at10?.value).toBe(12);
    expect(at10?.measured).toBe(false);
  });

  it('never lets a measurement speak for an hour that has not happened', () => {
    const s = buildSeries({
      key: 'temp', ...window, includeForecast: true,
      // A stray row stamped in the future must not become a measured sample.
      measured: [measured('2026-06-15T14:00', { temp: 99 })],
      model: model({
        futureHours: [
          hour('2026-06-15T13:00', { isPast: false, tempExact: 16 }),
          hour('2026-06-15T14:00', { isPast: false, tempExact: 17 }),
        ],
      }),
    });
    const at14 = s.samples.find((x) => x.key === '2026-06-15T14:00');
    expect(at14?.value).toBe(17);
    expect(at14?.measured).toBe(false);
    expect(at14?.future).toBe(true);
  });

  it('reports where the forecast starts, so the line can be split', () => {
    const s = buildSeries({
      key: 'temp', ...window, measured: [], model: model(), includeForecast: true,
    });
    expect(s.samples[s.forecastFrom]?.key).toBe('2026-06-15T13:00');
    expect(s.samples[s.forecastFrom - 1]?.future).toBe(false);
  });

  it('leaves a gap where nothing can answer for the hour', () => {
    const s = buildSeries({ key: 'temp', ...window, measured: [], model: model() });
    expect(s.samples.find((x) => x.key === '2026-06-15T03:00')?.value).toBeNull();
  });

  it('stops at the current hour unless the forecast is asked for', () => {
    const off = buildSeries({ key: 'temp', ...window, measured: [], model: model() });
    expect(off.samples[off.samples.length - 1]?.key).toBe('2026-06-15T12:00');
    expect(off.samples.some((x) => x.future)).toBe(false);
    expect(off.forecastFrom).toBe(-1);

    const on = buildSeries({
      key: 'temp', ...window, measured: [], model: model(), includeForecast: true,
    });
    expect(on.samples[on.samples.length - 1]?.key).toBe('2026-06-15T23:00');
  });

  it('reaches past the 48-hour strip into the IFS series', () => {
    const s = buildSeries({
      key: 'temp', from: '2026-06-20', to: '2026-06-20',
      measured: [],
      model: model({
        hresHoursByDay: {
          '2026-06-20': [
            { time: '2026-06-20T12:00', hour: 12, precip: 0, wmo: 3, is3h: true,
              temp: 24, dewpoint: 12, humidity: 55, wind: 14, windDir: 200,
              gusts: 30, sunMin: 60, et0h: 0.2 },
          ],
        },
      }),
      includeForecast: true,
    });
    const at12 = s.samples.find((x) => x.key === '2026-06-20T12:00');
    expect(at12?.value).toBe(24);
    expect(at12?.future).toBe(true);
  });

  it('reports how far ahead the model can be asked about', () => {
    expect(forecastHorizon(null)).toBeNull();
    expect(
      forecastHorizon(
        model({
          futureHours: [hour('2026-06-16T00:00', { isPast: false })],
          hresHoursByDay: {
            '2026-06-16': [],
            '2026-06-24': [],
          },
        })
      )
    ).toBe('2026-06-24');
  });

  it('buckets a long window into days, summing rain and averaging the rest', () => {
    const measuredHours = [
      measured('2026-06-10T10:00', { temp: 10, precip: 1 }),
      measured('2026-06-10T11:00', { temp: 20, precip: 2 }),
    ];
    const rain = buildSeries({
      key: 'precip', from: '2026-06-10', to: '2026-06-20',
      measured: measuredHours, model: null,
    });
    expect(rain.resolution).toBe('day');
    expect(rain.samples.find((s) => s.key === '2026-06-10')?.value).toBe(3);

    const temp = buildSeries({
      key: 'temp', from: '2026-06-10', to: '2026-06-20',
      measured: measuredHours, model: null,
    });
    const day = temp.samples.find((s) => s.key === '2026-06-10');
    expect(day?.value).toBe(15);
    expect(day?.band).toEqual({ lo: 10, hi: 20 });
  });

  it('calls a day measured only when every hour in it was', () => {
    const s = buildSeries({
      key: 'temp', from: '2026-06-14', to: '2026-06-20', includeForecast: true,
      measured: [measured('2026-06-15T10:00', { temp: 20 })],
      model: model({
        pastHours: [hour('2026-06-15T10:00'), hour('2026-06-15T11:00', { tempExact: 11 })],
        futureHours: [],
      }),
    });
    // 10:00 came from the station, 11:00 from the model — so the day did not.
    expect(s.samples.find((x) => x.key === '2026-06-15')?.measured).toBe(false);
  });

  it('summarises what is there, and says so when nothing is', () => {
    const empty = buildSeries({
      key: 'temp', from: '2026-01-01', to: '2026-01-01', measured: [], model: null,
    });
    expect(empty.stats).toBeNull();
    expect(empty.forecastFrom).toBe(-1);

    const s = buildSeries({
      key: 'precip', ...window,
      measured: [
        measured('2026-06-15T10:00', { precip: 1.2 }),
        measured('2026-06-15T11:00', { precip: 0.4 }),
      ],
      model: null,
    });
    expect(s.stats?.total).toBe(1.6);
    expect(s.stats?.max).toBe(1.2);
  });
});
