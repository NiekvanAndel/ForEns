/**
 * The surfaces the field-condition readings are drawn on: the blocks on 'Actueel',
 * the card order on 'Nu', and the row per location on the overview.
 *
 * `fieldAdvice` decides what is true and is tested on its own. These pin what the
 * surfaces do with it — which is mostly about what they leave out. A grid block whose
 * figure is a dash, a page whose only reading has been switched off, and a list of
 * locations with nothing wrong are three ways of taking up room and answering nothing.
 */
import { describe, it, expect } from 'vitest';
import { adviceTiles } from '../core/model/adviceTiles';
import { arrangeNowCards, NOW_CARDS, DEFAULT_NOW_LAYOUT } from '../core/nowCards';
import { locationAdvice, worstPerLocation } from '../core/overviewFieldAdvice';
import type { AdviceReading } from '../core/model/fieldAdvice';
import type { LocationOutlook, OutlookHour } from '../core/overviewData';
import type { ForecastModel, Hour } from '../core/model/types';

const NOW = '2026-04-20T06:00';

function reading(over: Partial<AdviceReading> = {}): AdviceReading {
  return {
    id: 'advice:spray', family: 'spray', factor: 'sprayWind', level: 2,
    value: 21, limit: 18, unit: 'kmh', at: NOW, window: null, closes: null,
    certainty: 'high', horizon: null, provenance: { kind: 'modelled', detail: null },
    ...over,
  };
}

const labels = {
  title: (r: AdviceReading) => r.factor,
  timeLabel: (r: AdviceReading) => r.family,
};

describe('the blocks on Actueel', () => {
  it('prints the reading in its own quantity, in the state\'s colour', () => {
    const [tile] = adviceTiles([reading()], labels);
    expect(tile).toMatchObject({ value: 21, kind: 'wind', status: 2 });
  });

  it('never carries the green dot: a spray window is not a measurement', () => {
    const tiles = adviceTiles([reading(), reading({ id: 'advice:frost', family: 'frost' })], labels);
    expect(tiles.every((t) => !t.measured)).toBe(true);
  });

  it('leaves a level-0 reading in ordinary ink rather than colouring "fine"', () => {
    const [tile] = adviceTiles([reading({ level: 0 })], labels);
    expect(tile?.status).toBeUndefined();
  });

  it('leaves out a reading with no figure rather than drawing a dash', () => {
    // An open spray window with nothing in the forecast to close it has a sentence
    // and no number — which the card can draw and a grid of figures cannot.
    expect(adviceTiles([reading({ factor: 'sprayOpen', value: null })], labels)).toEqual([]);
  });

  it('keeps one block per reading, whatever binds it that afternoon', () => {
    // Wind this morning and Delta T after lunch is one block in the grid: an id that
    // followed the reason would lose the reader's arrangement every time the weather
    // changed its mind.
    const wind = adviceTiles([reading({ factor: 'sprayWind' })], labels)[0];
    const deltaT = adviceTiles([reading({ factor: 'sprayDeltaTHigh' })], labels)[0];
    expect(wind?.id).toBe(deltaT?.id);
  });

  it('maps each unit onto the family the grid can convert', () => {
    const kinds = adviceTiles([
      reading({ id: 'a', unit: 'C' }), reading({ id: 'b', unit: 'mm' }),
      reading({ id: 'c', unit: 'days' }), reading({ id: 'd', unit: null }),
    ], labels).map((t) => t.kind);
    expect(kinds).toEqual(['temp', 'mm', 'count', 'count']);
  });
});

describe('the cards on Nu', () => {
  it('opens with the conclusions at the bottom', () => {
    const ids = arrangeNowCards(DEFAULT_NOW_LAYOUT).map((c) => c.id);
    expect(ids.slice(-2)).toEqual(['disease', 'advice']);
    expect(ids.indexOf('conditions')).toBeLessThan(ids.indexOf('advice'));
  });

  it('takes the reader\'s order, and drops what they switched off', () => {
    const ids = arrangeNowCards({ order: ['advice', 'disease'], hidden: ['radar'] })
      .map((c) => c.id);
    expect(ids.slice(0, 2)).toEqual(['advice', 'disease']);
    expect(ids).not.toContain('radar');
  });

  it('shows a card added later to somebody who arranged the page before it existed', () => {
    const ids = arrangeNowCards({ order: ['advice'], hidden: [] }).map((c) => c.id);
    expect(ids).toHaveLength(NOW_CARDS.length);
  });

  it('refuses to lose the one card the page is about', () => {
    // A stored layout that hid the conditions — by hand, or by a version that let it —
    // must not leave a tab named 'Nu' with no reading on it.
    const ids = arrangeNowCards({ order: [], hidden: ['conditions', 'radar'] })
      .map((c) => c.id);
    expect(ids).toContain('conditions');
    expect(ids).not.toContain('radar');
  });
});

describe('the field conditions of every location', () => {
  const start = Date.parse(`${NOW}:00Z`);

  const outlookHours = (count: number, over: Partial<OutlookHour> = {}): OutlookHour[] =>
    Array.from({ length: count }, (_, i) => ({
      time: new Date(start + i * 3600000).toISOString().slice(0, 16),
      temp: 18, humidity: 60, precip: 0, wind: 12, gusts: 18, isDay: 1,
      ...over,
    }));

  const outlook = (over: Partial<LocationOutlook> = {}): LocationOutlook =>
    ({ hours: outlookHours(48), days: [], ...over });

  const model = (past: Hour[] = []): ForecastModel => ({
    pastHours: past, futureHours: [], allHours: [], nowHour: NOW, days: [],
    currentTemp: 18, currentWmo: 1, nMembers: 51, hresRunLabel: null, hresHoursByDay: {},
  });

  it('reads the hour the location is in, not the one the phone is in', () => {
    // The outlook is trimmed to the location's own now, so its first hour is the key.
    // A page listing fields in two time zones would otherwise date them all by where
    // the reader happens to be standing.
    const a = locationAdvice({ index: 0, name: 'Heesch', outlook: outlook(), model: null });
    expect(a.readings.length).toBeGreaterThan(0);
    expect(a.readings.every((r) => (r.at ?? NOW) >= NOW)).toBe(true);
  });

  it('says nothing at all about a location that has not loaded', () => {
    const a = locationAdvice({ index: 0, name: 'Heesch', outlook: null, model: null });
    expect(a).toEqual({ index: 0, name: 'Heesch', readings: [], level: 0 });
  });

  it('carries the worst level as the location\'s own figure', () => {
    const windy = outlook({ hours: outlookHours(48, { wind: 30 }) });
    expect(locationAdvice({ index: 1, name: 'Nistelrode', outlook: windy, model: null }).level)
      .toBe(2);
  });

  it('computes only the families the reader left on', () => {
    const only = locationAdvice({
      index: 0, name: 'Heesch', outlook: outlook(), model: model(), families: ['frost'],
    });
    expect(only.readings.every((r) => r.family === 'frost')).toBe(true);
  });

  it('leaves out the fields with nothing wrong', () => {
    const fine = locationAdvice({ index: 0, name: 'Heesch', outlook: outlook(), model: null });
    const windy = locationAdvice({
      index: 1, name: 'Nistelrode', outlook: outlook({ hours: outlookHours(48, { wind: 30 }) }),
      model: null,
    });
    const shown = worstPerLocation([fine, windy]);
    expect(shown.map((r) => r.advice.name)).toEqual(['Nistelrode']);
  });

  it('counts the rest rather than listing them', () => {
    const bad = locationAdvice({
      index: 0, name: 'Heesch',
      outlook: outlook({ hours: outlookHours(48, { wind: 30, temp: -3, humidity: 90 }) }),
      model: null,
    });
    const [line] = worstPerLocation([bad]);
    expect(line?.reading.level).toBe(2);
    // Wind and blossom frost at once: the line names one and says there is more.
    expect(line?.others).toBeGreaterThan(0);
  });

  it('puts the shut fields above the merely watchful ones', () => {
    const shut = locationAdvice({
      index: 3, name: 'Rosmalen', outlook: outlook({ hours: outlookHours(48, { wind: 30 }) }),
      model: null,
    });
    // Fine now, with a touch of ground frost the night after next: worth knowing,
    // not shut.
    const chilly = outlookHours(48).map((h, i) =>
      (i === 20 ? { ...h, temp: 1, humidity: 90 } : h));
    const watch = locationAdvice({
      index: 0, name: 'Heesch', outlook: outlook({ hours: chilly }), model: null,
    });
    expect(watch.level).toBe(1);
    expect(worstPerLocation([watch, shut]).map((r) => r.advice.index)).toEqual([3, 0]);
  });
});
