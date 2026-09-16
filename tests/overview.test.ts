/**
 * The overview page: its catalogue, its arrangement, and the readings its widgets
 * are made of.
 *
 * All of it pure, because the page is twelve widgets over a request per location and
 * the parts worth getting right — which fetches an arrangement justifies, and what
 * "the coming night" means — must not need a phone to check.
 */
import { describe, expect, it } from 'vitest';
import {
  arrangeWidgets, DEFAULT_OVERVIEW_LAYOUT, neededSources, OVERVIEW_WIDGETS, widgetRows,
} from '../core/overview';
import {
  buildOverviewRow, DEFAULT_WORK_LIMITS, firstWorkRun, notableRows, rankRows, spreadOf,
  summariseOverview, tonightMinimum, trendOf, workWindow,
  type OutlookHour, type OverviewRow,
} from '../core/overviewData';
import { parseOutlook } from '../core/sources/outlook';
import { dayAgreement, parseEnsembleOutlook } from '../core/sources/ensembleOutlook';
import { mergePrefs } from '../core/prefs';

const hour = (time: string, over: Partial<OutlookHour> = {}): OutlookHour =>
  ({ time, temp: 12, precip: 0, wind: 10, gusts: 18, ...over });

const row = (over: Partial<OverviewRow> = {}): OverviewRow => ({
  index: 0, name: 'Hedikhuizen', hasStation: false, loading: false,
  tempC: 15, humidity: 70, windKmh: 12, gustKmh: 20, windDir: 180, wmo: 1,
  rain24: 0, rainToday: 0, rainNext24: 0, tonightMinC: 5, days: [], hours: [],
  rainTrail: [], tempTrail: [], ensemble: null,
  ...over,
});

describe('the widget catalogue', () => {
  it('has a view-independent entry per widget, with no duplicate ids', () => {
    const ids = OVERVIEW_WIDGETS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('shows a new widget to somebody who arranged the page before it existed', () => {
    // An id the layout has never heard of keeps its natural place — which is what
    // makes adding a widget a one-line change and not a migration.
    const old = { order: ['map', 'summary'], hidden: [] };
    const shown = arrangeWidgets(old).map((w) => w.id);
    expect(shown.slice(0, 2)).toEqual(['map', 'summary']);
    expect(shown).toContain('workability');
  });

  it('drops what was switched off', () => {
    const arranged = arrangeWidgets({ order: [], hidden: ['summary', 'map'] });
    expect(arranged.map((w) => w.id)).not.toContain('summary');
    expect(arranged.map((w) => w.id)).not.toContain('map');
  });

  it('starts with the heavier widgets off', () => {
    // Twelve widgets is a scroll, not a summary; the pencil is how the rest arrive.
    const shown = arrangeWidgets(DEFAULT_OVERVIEW_LAYOUT).map((w) => w.id);
    expect(shown).toContain('summary');
    expect(shown).not.toContain('nowcast');
  });
});

describe('neededSources', () => {
  it('asks for nothing an arrangement does not draw', () => {
    // The saving is a request per saved location, so this is the difference between
    // eight requests and twenty-four on a page with eight fields.
    const onlyMap = neededSources({ order: [], hidden: OVERVIEW_WIDGETS.map((w) => w.id).filter((id) => id !== 'map') });
    expect([...onlyMap]).toEqual([]);

    const withRain = neededSources({
      order: [],
      hidden: OVERVIEW_WIDGETS.map((w) => w.id).filter((id) => id !== 'rain24'),
    });
    expect([...withRain]).toEqual(['conditions']);
  });

  it('turns the nowcast on only for the widget that reads it', () => {
    expect(neededSources(DEFAULT_OVERVIEW_LAYOUT).has('nowcast')).toBe(false);
    expect(neededSources({ order: [], hidden: [] }).has('nowcast')).toBe(true);
  });
});

describe('widgetRows', () => {
  const w = (id: string, size: 'full' | 'half') => ({ id, size, needs: [] as const });

  it('pairs halves and leaves fulls alone', () => {
    const rows = widgetRows([w('a', 'half'), w('b', 'half'), w('c', 'full')]);
    expect(rows.map((r) => r.map((x) => x.id))).toEqual([['a', 'b'], ['c']]);
  });

  it('lets a half stand alone rather than stretch', () => {
    // A half at full width is a widget claiming a prominence its author did not ask
    // for, so an odd one out keeps its size and the row keeps the gap.
    expect(widgetRows([w('a', 'half'), w('b', 'full')]).map((r) => r.length)).toEqual([1, 1]);
    expect(widgetRows([w('a', 'half')]).map((r) => r.length)).toEqual([1]);
  });
});

describe('tonightMinimum', () => {
  it('is the coldest of the coming night, not of the next twelve hours', () => {
    const hours = [
      hour('2026-04-10T14:00', { temp: 14 }),
      hour('2026-04-10T20:00', { temp: 6 }),
      hour('2026-04-11T03:00', { temp: -2 }),
      hour('2026-04-11T08:00', { temp: 1 }),
      hour('2026-04-11T13:00', { temp: 15 }),
    ];
    expect(tonightMinimum(hours)).toBe(-2);
  });

  it('ignores the daytime, whatever the reading', () => {
    expect(tonightMinimum([hour('2026-04-10T13:00', { temp: -9 })])).toBeNull();
  });
});

describe('workWindow', () => {
  it('names why an hour is out, in the order things stop the work', () => {
    const w = workWindow([
      hour('2026-04-10T08:00'),
      hour('2026-04-10T09:00', { precip: 0.4 }),
      hour('2026-04-10T10:00', { wind: 30 }),
      hour('2026-04-10T11:00', { temp: -1 }),
      // Wet and windy at once reads as wet: the rain is what sends you home.
      hour('2026-04-10T12:00', { precip: 1, wind: 40 }),
    ]);
    expect(w.map((h) => h.verdict)).toEqual(['yes', 'wet', 'windy', 'cold', 'wet']);
  });

  it('will not call a gap a green light', () => {
    const w = workWindow([hour('2026-04-10T08:00', { wind: null })]);
    expect(w[0]!.verdict).toBe('unknown');
  });

  it('takes its limits from the caller', () => {
    const gusty = [hour('2026-04-10T08:00', { wind: 25 })];
    expect(workWindow(gusty)[0]!.verdict).toBe('windy');
    expect(workWindow(gusty, { ...DEFAULT_WORK_LIMITS, windKmh: 30 })[0]!.verdict).toBe('yes');
  });

  it('finds the first run, which is what a grower plans around', () => {
    const w = workWindow([
      hour('2026-04-10T08:00', { precip: 1 }),
      hour('2026-04-10T09:00'),
      hour('2026-04-10T10:00'),
      hour('2026-04-10T11:00', { precip: 1 }),
      hour('2026-04-10T12:00'),
    ]);
    expect(firstWorkRun(w)).toEqual({ from: '2026-04-10T09:00', hours: 2 });
    expect(firstWorkRun(workWindow([hour('2026-04-10T08:00', { precip: 9 })]))).toBeNull();
  });

  it('counts a run that reaches the end of the forecast', () => {
    const w = workWindow([hour('2026-04-10T08:00'), hour('2026-04-10T09:00')]);
    expect(firstWorkRun(w)).toEqual({ from: '2026-04-10T08:00', hours: 2 });
  });
});

describe('rankRows', () => {
  it('puts a location that is not reporting at the back, not at the bottom', () => {
    // A field with no reading is not a field with the least rain.
    const ranked = rankRows(
      [row({ name: 'A', rain24: 1 }), row({ name: 'B', rain24: null }), row({ name: 'C', rain24: 5 })],
      (r) => r.rain24
    );
    expect(ranked.map((r) => r.name)).toEqual(['C', 'A', 'B']);
  });

  it('can rank the other way, for the coldest', () => {
    const ranked = rankRows(
      [row({ name: 'A', tonightMinC: 4 }), row({ name: 'B', tonightMinC: -2 })],
      (r) => r.tonightMinC,
      'asc'
    );
    expect(ranked.map((r) => r.name)).toEqual(['B', 'A']);
  });
});

describe('summariseOverview', () => {
  it('names the extremes and the wettest', () => {
    const s = summariseOverview([
      row({ name: 'A', tempC: 12, rain24: 0 }),
      row({ name: 'B', tempC: 18, rain24: 7.2 }),
    ]);
    expect(s.warmest).toEqual({ name: 'B', value: 18 });
    expect(s.coldest).toEqual({ name: 'A', value: 12 });
    expect(s.wettest).toEqual({ name: 'B', value: 7.2 });
  });

  it('says nothing about rain where none fell', () => {
    const s = summariseOverview([row({ rain24: 0 })]);
    expect(s.wettest).toBeNull();
  });

  it('lists only the locations expecting rain worth mentioning', () => {
    const s = summariseOverview([
      row({ name: 'A', rainNext24: 0.2 }),
      row({ name: 'B', rainNext24: 4 }),
    ]);
    expect(s.rainAhead).toEqual(['B']);
  });

  it('knows it is still waiting rather than claiming everywhere is dry', () => {
    expect(summariseOverview([row({ loading: true })]).loading).toBe(true);
    expect(summariseOverview([row({ loading: true }), row({ loading: false })]).loading).toBe(false);
  });
});

describe('buildOverviewRow', () => {
  it('draws whatever has landed, and nulls the rest', () => {
    // The sources arrive independently, so a row is always drawable and never
    // complete — a widget reading only the conditions must not wait on the outlook.
    const r = buildOverviewRow({
      index: 2, name: 'Almkerk', hasStation: true, loading: false,
      model: null, outlook: null,
    });
    expect(r.index).toBe(2);
    expect(r.hasStation).toBe(true);
    expect(r.tempC).toBeNull();
    expect(r.rainNext24).toBeNull();
    expect(r.days).toEqual([]);
  });
});

describe('parseOutlook', () => {
  it('starts at the hour the location is in, not at midnight', () => {
    // Every widget that reads these asks "from now", so trimming here means none of
    // them has to — and the offset is the location's, not the device's.
    const out = parseOutlook(
      {
        utc_offset_seconds: 7200,
        hourly: {
          time: ['2026-04-10T10:00', '2026-04-10T11:00', '2026-04-10T12:00'],
          temperature_2m: [10, 11, 12],
          precipitation: [0, 0.2, 0],
          windspeed_10m: [8, 9, 10],
        },
        daily: {
          time: ['2026-04-10'],
          temperature_2m_max: [14],
          temperature_2m_min: [3],
          precipitation_sum: [1.2],
        },
      },
      Date.UTC(2026, 3, 10, 9, 0)
    );
    expect(out!.hours.map((h) => h.time)).toEqual(['2026-04-10T11:00', '2026-04-10T12:00']);
    expect(out!.days[0]).toMatchObject({ tempMin: 3, tempMax: 14, precip: 1.2 });
  });

  it('is null rather than empty when there is nothing', () => {
    expect(parseOutlook(null)).toBeNull();
    expect(parseOutlook({})).toBeNull();
  });
});

describe('the stored arrangement', () => {
  it('survives storage, and defaults to the catalogue', () => {
    expect(mergePrefs(null).overview).toEqual(DEFAULT_OVERVIEW_LAYOUT);
    const kept = mergePrefs({ overview: { order: ['map'], hidden: ['temp'] } });
    expect(kept.overview).toEqual({ order: ['map'], hidden: ['temp'] });
    // Half a layout must not cost the reader the other half.
    expect(mergePrefs({ overview: { order: ['map'] } }).overview).toEqual({ order: ['map'], hidden: [] });
  });
});

describe('notableRows', () => {
  const at = (name: string, rain: number | null) => row({ name, rain24: rain });

  it('shows what clears the bar and counts the rest', () => {
    // Eight lines of "0,0 mm" teach a reader that the widget is noise, and they stop
    // looking on the morning it is not. "And five others dry" is a fact.
    const out = notableRows(
      [at('A', 0), at('B', 4), at('C', 0.05), at('D', 1.2)],
      (r) => r.rain24,
      0.1
    );
    expect(out.shown.map((r) => r.name)).toEqual(['B', 'D']);
    expect(out.rest).toBe(2);
    expect(out.empty).toBe(false);
  });

  it('says when nothing cleared it rather than drawing an empty card', () => {
    const out = notableRows([at('A', 0), at('B', 0)], (r) => r.rain24, 0.1);
    expect(out.empty).toBe(true);
    expect(out.shown).toEqual([]);
  });

  it('counts a location with no reading among the rest, not among the shown', () => {
    const out = notableRows([at('A', null), at('B', 3)], (r) => r.rain24, 0.1);
    expect(out.shown.map((r) => r.name)).toEqual(['B']);
    expect(out.rest).toBe(1);
  });

  it('caps the list, because a widget is a summary', () => {
    const many = Array.from({ length: 9 }, (_, i) => at(`L${i}`, i + 1));
    const out = notableRows(many, (r) => r.rain24, 0.1);
    expect(out.shown).toHaveLength(5);
    expect(out.rest).toBe(4);
  });

  it('can count the other way, for the coldest', () => {
    const out = notableRows(
      [row({ name: 'A', tonightMinC: 8 }), row({ name: 'B', tonightMinC: -1 })],
      (r) => r.tonightMinC,
      3,
      'asc'
    );
    expect(out.shown.map((r) => r.name)).toEqual(['B']);
  });
});

describe('spreadOf', () => {
  it('is what lets a comparison collapse to one line', () => {
    // Within a couple of degrees there is no comparison to draw, and a column of
    // near-identical numbers is height spent saying "the same".
    expect(spreadOf([row({ tempC: 15 }), row({ tempC: 16 })], (r) => r.tempC))
      .toEqual({ min: 15, max: 16, span: 1 });
    expect(spreadOf([row({ tempC: null })], (r) => r.tempC)).toBeNull();
  });
});

describe('trendOf', () => {
  it('points only where something actually moved', () => {
    expect(trendOf(1, 4)).toBe('up');
    expect(trendOf(4, 1)).toBe('down');
    expect(trendOf(1, 1.05)).toBe('flat');
    expect(trendOf(null, 4)).toBe('flat');
  });
});

describe('parseEnsembleOutlook', () => {
  const daily = {
    time: ['2026-04-10', '2026-04-11'],
    precipitation_sum_member01: [0, 8],
    precipitation_sum_member02: [0, 0],
    precipitation_sum_member03: [0.4, 2],
  };

  it('reads where the members land, and how many are wet at all', () => {
    // Two separate questions: "will it rain" and "how much", and the second does not
    // answer the first — a median of nothing with a third of the members wet is a day
    // worth knowing about.
    const out = parseEnsembleOutlook({ daily })!;
    expect(out).toHaveLength(2);
    expect(out[0]!.wetShare).toBe(33);
    expect(out[1]!.p50).toBe(2);
    expect(out[1]!.members).toBe(3);
  });

  it('refuses a deterministic run dressed as an ensemble', () => {
    // One column is the plain series passed through, and a spread of one member is a
    // point pretending to be a range.
    expect(parseEnsembleOutlook({ daily: { time: ['2026-04-10'], precipitation_sum: [3] } })).toBeNull();
    expect(parseEnsembleOutlook(null)).toBeNull();
  });
});

describe('dayAgreement', () => {
  const day = (p10: number, p50: number, p90: number) =>
    ({ date: 'x', p10, p50, p90, wetShare: 50, members: 51 });

  it('calls a narrow band agreement whatever the total', () => {
    expect(dayAgreement(day(0, 0, 0))).toBe('agree');
    expect(dayAgreement(day(11.5, 12, 12.2))).toBe('agree');
  });

  it('reads the band against how much rain there is', () => {
    // Five millimetres of disagreement means something different under a dry forecast
    // than under a wet one, so it is a ratio and not a threshold in millimetres.
    expect(dayAgreement(day(0, 1, 6))).toBe('disagree');
    expect(dayAgreement(day(8, 12, 16))).toBe('mixed');
  });

  it('does not call a trace of drizzle a violent disagreement', () => {
    // The floor under the ratio: without it every near-dry day reads as uncertain.
    expect(dayAgreement(day(0, 0.2, 1.8))).toBe('mixed');
  });
});
