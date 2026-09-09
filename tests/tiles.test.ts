/**
 * The 'Actueel' grid and the 'Grafiek' series.
 *
 * Both are places where a wrong answer looks like a right one. A block can put an
 * instrument's authority behind a number a model supplied and still read as a
 * plausible reading; a chart can run a forecast on into a measured line and still
 * read as a chart. So the thing pinned hardest here is which source a value came
 * from — per quantity, because a rain gauge measures some of them and not others.
 */
import { describe, it, expect } from 'vitest';
import { modelTiles, nowcastDepth, type TileLabels } from '../core/model/tiles';
import {
  arrangeAllTiles, arrangeTiles, DEFAULT_TILE_LAYOUT, reorderTiles, toggleTile,
} from '../core/prefs';
import {
  buildSeries, daySpan, forecastHorizon, hourKeys, SERIES_META, timeKeys,
} from '../core/model/series';
import { localMinuteKey, parseRows } from '../core/sources/agroexact';
import type { ForecastModel, Hour } from '../core/model/types';
import type { MeasuredHour } from '../core/sources/agroexact';

const labels: TileLabels = {
  temperature: 'Temperatuur', humidity: 'Luchtvochtigheid',
  windSpeed: 'Windsnelheid', windGust: 'Windstoot', windDirection: 'Windrichting',
  gustMax: 'Max. windstoot', rain: 'Neerslag', rainNext: 'Neerslagverwachting',
  tempMax: 'Max. temperatuur', tempMin: 'Min. temperatuur',
  now: 'nu', today: 'vandaag',
  last6h: 'laatste 6 uur', last12h: 'laatste 12 uur', last24h: 'laatste 24 uur',
  next1h: 'komend uur', next24h: 'komende 24 uur',
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
  wind: 8, gusts: 15, windDir: 90, precip: 0, radiation: null, ...over,
});

describe('modelTiles', () => {
  it('marks nothing as measured on a location with no station', () => {
    const tiles = modelTiles(model(), labels);
    expect(tiles.every((t) => !t.measured)).toBe(true);
  });

  it("prefers the station's reading and marks only what it measured", () => {
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
    // The gauge measured the rainfall, so its four windows carry the dot even
    // though each is summed out of the merged hours rather than read off `current`.
    expect(byId.get('rain-24h')?.measured).toBe(true);
    expect(byId.get('temp-max')?.measured).toBe(true);
    // Nothing measured the wind, so the model answers and the block does not put an
    // instrument's authority behind it.
    expect(byId.get('wind')?.value).toBe(12);
    expect(byId.get('wind')?.measured).toBe(false);
    expect(byId.get('gust-max')?.measured).toBe(false);
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
      'rain-next-1h', 'rain-next-24h',
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

  it("answers today's strongest gust without a station", () => {
    // The observation feed reports gusts and `processAll` now keeps them on past
    // hours, so this block is no longer answerable only where there is an
    // instrument — which is what the comparison sheet needs of every location.
    const byId = new Map(
      modelTiles(
        model({
          pastHours: [
            hour('2026-06-15T10:00', { gusts: 44 }),
            hour('2026-06-15T11:00', { gusts: 61 }),
          ],
        }),
        labels
      ).map((t) => [t.id, t])
    );
    expect(byId.get('gust-max')?.value).toBe(61);
    expect(byId.get('gust-max')?.measured).toBe(false);
  });

  it('reads a wind direction as a bearing the page can turn into a compass point', () => {
    const byId = new Map(modelTiles(model(), labels).map((t) => [t.id, t]));
    expect(byId.get('wind-dir')?.kind).toBe('direction');
    expect(byId.get('wind-dir')?.value).toBe(180);
  });
});

describe('the two forecast blocks', () => {
  const bars = (rates: [number, number][]) =>
    rates.map(([offsetMin, mmPerHour]) => ({ offsetMin, mmPerHour, height: 0 }));

  it('turns the nowcast rates into a depth over the hour', () => {
    // Five minutes at 12 mm/h is 1 mm, so six such samples are 6 mm.
    const series = bars([[0, 12], [5, 12], [10, 12], [15, 12], [20, 12], [25, 12]]);
    expect(nowcastDepth(series, 60)).toBe(6);
  });

  it('ignores the observed frames behind now, and anything past the window', () => {
    const series = bars([[-10, 60], [-5, 60], [0, 12], [90, 60]]);
    // Only the sample at 0 counts: the two behind now are observations, and 90
    // minutes is outside the hour asked for.
    expect(nowcastDepth(series, 60)).toBe(1);
  });

  it('says nothing rather than zero where there is no run at all', () => {
    expect(nowcastDepth(undefined, 60)).toBeNull();
    expect(nowcastDepth([], 60)).toBeNull();
  });

  it('never marks a forecast as measured, station or not', () => {
    const byId = new Map(
      modelTiles(
        model({
          station: {
            id: 'st1', name: 'Rosmalen',
            current: {
              time: '2026-06-15T12:00', measTime: '2026-06-15T12:10:00Z',
              temp: 21.3, humidity: 60, dewpoint: 8, wind: 9, gusts: 15,
              windDir: 90, precip: 0.4,
            },
          },
        }),
        labels,
        { series: bars([[0, 12]]) }
      ).map((t) => [t.id, t])
    );
    expect(byId.get('rain-next-1h')?.value).toBe(1);
    expect(byId.get('rain-next-1h')?.measured).toBe(false);
    expect(byId.get('rain-next-24h')?.measured).toBe(false);
  });

  it('sums the model\'s own hours for the day ahead', () => {
    const byId = new Map(
      modelTiles(
        model({
          futureHours: [
            hour('2026-06-15T12:00', { isPast: false, precip: 0.5 }),
            hour('2026-06-15T13:00', { isPast: false, precip: 1.5 }),
          ],
        }),
        labels
      ).map((t) => [t.id, t])
    );
    expect(byId.get('rain-next-24h')?.value).toBe(2);
    // No nowcast handed in: a dash, not a zero.
    expect(byId.get('rain-next-1h')?.value).toBeNull();
  });
});

describe('a single day at the grain a station reports on', () => {
  it('steps the grid by the interval it is given', () => {
    const keys = timeKeys('2026-06-15', '2026-06-15', 10);
    expect(keys).toHaveLength(6 * 24);
    expect(keys[0]).toBe('2026-06-15T00:00');
    expect(keys[1]).toBe('2026-06-15T00:10');
    expect(keys[keys.length - 1]).toBe('2026-06-15T23:50');
    // The default is still the hour, and `hourKeys` is that default.
    expect(timeKeys('2026-06-15', '2026-06-15')).toEqual(hourKeys('2026-06-15', '2026-06-15'));
  });

  it('reports the finer grain, and takes a reading at its own minute', () => {
    const s = buildSeries({
      key: 'temp', from: '2026-06-15', to: '2026-06-15', stepMinutes: 10,
      measured: [measured('2026-06-15T10:20', { temp: 18.4 })],
      model: model(),
    });
    expect(s.resolution).toBe('minute');
    const at = s.samples.find((x) => x.key === '2026-06-15T10:20');
    expect(at?.value).toBe(18.4);
    expect(at?.measured).toBe(true);
  });

  it('lets the hour answer for the minutes inside it where the station is quiet', () => {
    const s = buildSeries({
      key: 'temp', from: '2026-06-15', to: '2026-06-15', stepMinutes: 10,
      measured: [],
      // The model is stamped on the hour and has nothing to say about 10:20 in
      // particular, so the hour it falls inside is what answers.
      model: model({ pastHours: [hour('2026-06-15T10:00', { tempExact: 11 })] }),
    });
    expect(s.samples.find((x) => x.key === '2026-06-15T10:20')?.value).toBe(11);
    expect(s.samples.find((x) => x.key === '2026-06-15T10:20')?.measured).toBe(false);
  });

  it('still buckets a long window into days whatever the step', () => {
    const s = buildSeries({
      key: 'precip', from: '2026-06-01', to: '2026-06-20', stepMinutes: 10,
      measured: [measured('2026-06-02T10:20', { precip: 2 })],
      model: null,
    });
    expect(s.resolution).toBe('day');
    expect(s.samples.find((x) => x.key === '2026-06-02')?.value).toBe(2);
  });
});

describe('reading a station\'s raw measurements', () => {
  it('floors a timestamp to the interval the station reports on', () => {
    // 08:37 UTC, two hours east, lands in the 10:30 slot.
    expect(localMinuteKey('2026-06-15T08:37:11Z', 7200)).toBe('2026-06-15T10:30');
    expect(localMinuteKey('2026-06-15T08:40:00Z', 7200)).toBe('2026-06-15T10:40');
  });

  it('says nothing for a timestamp it cannot read', () => {
    expect(localMinuteKey('not a time', 0)).toBe('');
  });

  it('parses both an array and a stream of one record per line', () => {
    expect(parseRows<{ a: number }>('[{"a":1},{"a":2}]')).toEqual([{ a: 1 }, { a: 2 }]);
    expect(parseRows<{ a: number }>('{"a":1}\n{"a":2}\n')).toEqual([{ a: 1 }, { a: 2 }]);
    expect(parseRows('')).toEqual([]);
  });

  it('skips a record it cannot read rather than losing the series', () => {
    // A station that wrote one bad line should cost that line and not the chart.
    expect(parseRows<{ a: number }>('{"a":1}\nnot json\n{"a":3}')).toEqual([{ a: 1 }, { a: 3 }]);
  });
});

describe('the two quantities added last', () => {
  const window = { from: '2026-06-15', to: '2026-06-15' };

  it('plots a bearing as points on a pinned compass axis', () => {
    expect(SERIES_META.windDir.shape).toBe('dots');
    // A stroke between two bearings would draw the wind swinging the long way round,
    // and a dynamic axis would turn 170°–190° into a plot full of wild swings.
    expect(SERIES_META.windDir.axisFixed).toBe(true);
    expect(SERIES_META.windDir.axisMin).toBe(0);
    expect(SERIES_META.windDir.axisMax).toBe(360);
  });

  it('averages bearings the long way round, not the arithmetic way', () => {
    const s = buildSeries({
      key: 'windDir', from: '2026-06-10', to: '2026-06-20',
      measured: [
        measured('2026-06-11T10:00', { windDir: 350 }),
        measured('2026-06-11T11:00', { windDir: 10 }),
      ],
      model: null,
    });
    // The arithmetic mean is 180 — due south, the one direction it never blew from.
    expect(s.samples.find((x) => x.key === '2026-06-11')?.value).toBe(0);
    // And no band: it would run the wrong way round the compass half the time.
    expect(s.samples.find((x) => x.key === '2026-06-11')?.band).toBeNull();
  });

  it('prefers the station\'s radiation, in the one unit both sides use', () => {
    const s = buildSeries({
      key: 'radiation', ...window,
      measured: [measured('2026-06-15T10:00', { radiation: 861 })],
      model: model({ pastHours: [hour('2026-06-15T10:00', { radiation: 420 })] }),
    });
    const at = s.samples.find((x) => x.key === '2026-06-15T10:00');
    expect(at?.value).toBe(861);
    expect(at?.measured).toBe(true);
  });

  it('falls back to the model where the station has no sensor for it', () => {
    const s = buildSeries({
      key: 'radiation', ...window,
      measured: [measured('2026-06-15T10:00', { radiation: null })],
      model: model({ pastHours: [hour('2026-06-15T10:00', { radiation: 420 })] }),
    });
    expect(s.samples.find((x) => x.key === '2026-06-15T10:00')?.value).toBe(420);
  });

  it('keeps humidity inside nought and a hundred', () => {
    expect(SERIES_META.humidity.axisMin).toBe(0);
    expect(SERIES_META.humidity.axisMax).toBe(100);
    // Rainfall, wind and radiation cannot go negative; none of them has a ceiling.
    for (const key of ['precip', 'wind', 'radiation'] as const) {
      expect(SERIES_META[key].axisMin).toBe(0);
      expect(SERIES_META[key].axisMax).toBeUndefined();
    }
    // Temperature has neither: below zero is a real reading.
    expect(SERIES_META.temp.axisMin).toBeUndefined();
  });

  it('reports the strongest gust beside the strongest mean wind', () => {
    const s = buildSeries({
      key: 'wind', ...window,
      measured: [
        measured('2026-06-15T10:00', { wind: 12, gusts: 31 }),
        measured('2026-06-15T11:00', { wind: 18, gusts: 24 }),
      ],
      model: null,
    });
    expect(s.stats?.max).toBe(18);
    expect(s.stats?.secondaryMax).toBe(31);
    expect(SERIES_META.wind.summary).toBe('wind');
  });

  it('has no gust to report where nothing measured one', () => {
    const s = buildSeries({
      key: 'temp', ...window,
      measured: [measured('2026-06-15T10:00', { temp: 12 })],
      model: null,
    });
    expect(s.stats?.secondaryMax).toBeNull();
  });
});

describe('the running rainfall total', () => {
  const window = { from: '2026-06-15', to: '2026-06-15' };

  it('accumulates across the window, and only for rainfall', () => {
    const rain = buildSeries({
      key: 'precip', ...window,
      measured: [
        measured('2026-06-15T10:00', { precip: 1.2 }),
        measured('2026-06-15T11:00', { precip: 0.4 }),
      ],
      model: null,
    });
    const at = (k: string) => rain.samples.find((s) => s.key === k);
    expect(at('2026-06-15T10:00')?.cumulative).toBe(1.2);
    expect(at('2026-06-15T11:00')?.cumulative).toBe(1.6);
    // The last sample of the window carries the window's whole total.
    expect(rain.samples[rain.samples.length - 1]?.cumulative).toBe(1.6);

    // A running total of temperatures is a number with no meaning.
    const temp = buildSeries({ key: 'temp', ...window, measured: [], model: model() });
    expect(temp.samples.every((s) => s.cumulative === undefined)).toBe(true);
  });

  it('starts at the left edge of the chosen window, not before it', () => {
    const s = buildSeries({
      key: 'precip', ...window,
      measured: [
        // Yesterday is outside the window and must not be in the total.
        measured('2026-06-14T23:00', { precip: 9 }),
        measured('2026-06-15T10:00', { precip: 2 }),
      ],
      model: null,
    });
    expect(s.samples[s.samples.length - 1]?.cumulative).toBe(2);
  });

  it('holds its level across an hour nothing reported', () => {
    const s = buildSeries({
      key: 'precip', ...window,
      measured: [measured('2026-06-15T10:00', { precip: 3 })],
      model: null,
    });
    // An unreported hour is unknown, not dry-and-undoing: the line stays put.
    expect(s.samples.find((x) => x.key === '2026-06-15T03:00')?.cumulative).toBe(0);
    expect(s.samples.find((x) => x.key === '2026-06-15T18:00')?.cumulative).toBe(3);
  });

  it('keeps each sample\'s forecast flag, which is what dashes the line', () => {
    const s = buildSeries({
      key: 'precip', ...window, measured: [], model: model(), includeForecast: true,
    });
    // The running total is drawn solid up to now and dashed after it, and it can
    // only be split there if the flag survived the accumulation.
    expect(s.samples.some((x) => x.future && x.cumulative != null)).toBe(true);
    expect(s.samples.some((x) => !x.future && x.cumulative != null)).toBe(true);
  });

  it('adds a bucketed day once, not hour by hour', () => {
    const s = buildSeries({
      key: 'precip', from: '2026-06-10', to: '2026-06-20',
      measured: [
        measured('2026-06-10T10:00', { precip: 1 }),
        measured('2026-06-10T11:00', { precip: 2 }),
        measured('2026-06-11T10:00', { precip: 4 }),
      ],
      model: null,
    });
    expect(s.resolution).toBe('day');
    expect(s.samples.find((x) => x.key === '2026-06-10')?.cumulative).toBe(3);
    expect(s.samples.find((x) => x.key === '2026-06-11')?.cumulative).toBe(7);
  });
});

describe('the grid arrangement', () => {
  const tiles = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('leaves the natural order alone until the reader changes it', () => {
    expect(arrangeTiles(tiles, DEFAULT_TILE_LAYOUT).map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('drops the hidden blocks from the grid but not from the editor', () => {
    const layout = toggleTile(DEFAULT_TILE_LAYOUT, 'b');
    expect(arrangeTiles(tiles, layout).map((t) => t.id)).toEqual(['a', 'c']);
    expect(arrangeAllTiles(tiles, layout).map((t) => t.id)).toEqual(['a', 'b', 'c']);
    // And back off again.
    expect(toggleTile(layout, 'b').hidden).toEqual([]);
  });

  it('shows a block the layout has never heard of, in its natural place', () => {
    // Someone who arranged their grid before 'c' existed must still get 'c'.
    const layout = { order: ['b', 'a'], hidden: [] };
    expect(arrangeTiles(tiles, layout).map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });

  it('forgets an id the app no longer draws', () => {
    const layout = { order: ['gone', 'c', 'a'], hidden: ['also-gone'] };
    expect(arrangeTiles(tiles, layout).map((t) => t.id)).toEqual(['c', 'a', 'b']);
  });

  it('writes the whole order back when a block is moved', () => {
    const moved = reorderTiles(DEFAULT_TILE_LAYOUT, ['a', 'b', 'c'], 2, 0);
    expect(moved.order).toEqual(['c', 'a', 'b']);
    expect(arrangeTiles(tiles, moved).map((t) => t.id)).toEqual(['c', 'a', 'b']);
  });

  it('ignores a move that goes nowhere or off the end', () => {
    expect(reorderTiles(DEFAULT_TILE_LAYOUT, ['a', 'b'], 1, 1)).toBe(DEFAULT_TILE_LAYOUT);
    expect(reorderTiles(DEFAULT_TILE_LAYOUT, ['a', 'b'], 0, 5)).toBe(DEFAULT_TILE_LAYOUT);
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
