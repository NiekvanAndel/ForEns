/**
 * Measurements over model, and the station→location sync.
 *
 * These are the two places where the AgroExact integration can be quietly wrong
 * rather than loudly broken: a merge that drops a quantity the station did not
 * measure, and a sync that deletes someone's location because a request came back
 * short. Both are pure functions, so both are pinned here.
 */
import { describe, it, expect } from 'vitest';
import {
  applyStationObservations, mergeHour, recent24, measurementTimeLabel, stationForLocation,
} from '../core/model/station';
import {
  DEFAULT_PREFS, syncStationLocations, unlinkStationLocations,
  type Prefs, type SavedLocation, type StationPlace,
} from '../core/prefs';
import type { ForecastModel, Hour } from '../core/model/types';
import type { StationObservations } from '../core/sources/agroexact';

const hour = (time: string, over: Partial<Hour> = {}): Hour => ({
  time, temp: 10, precip: 0, wind: 12, humidity: 70, wmo: 3,
  isDay: 1, isPast: true, gusts: 20, windDir: 180, dewpoint: 5, ...over,
});

const model = (over: Partial<ForecastModel> = {}): ForecastModel => ({
  pastHours: [hour('2026-06-15T10:00'), hour('2026-06-15T11:00')],
  futureHours: [hour('2026-06-15T12:00', { isPast: false, temp: 15 })],
  allHours: [],
  nowHour: '2026-06-15T12:00',
  days: [],
  currentTemp: 15,
  currentWmo: 3,
  nMembers: 0,
  hresRunLabel: null,
  hresHoursByDay: {},
  ...over,
});

const observations = (over: Partial<StationObservations> = {}): StationObservations => ({
  stationId: 'st1',
  stationName: 'Weide',
  hours: {},
  current: null,
  ...over,
});

describe('mergeHour', () => {
  it('replaces a quantity the station measured and keeps the rest', () => {
    const merged = mergeHour(hour('2026-06-15T10:00'), {
      time: '2026-06-15T10:00',
      temp: 18, tempMin: null, tempMax: null,
      humidity: null, humidityMin: null, humidityMax: null, dewpoint: null,
      wind: null, gusts: null, windDir: null, radiation: null, precip: 1.2,
    });
    expect(merged.temp).toBe(18);
    expect(merged.precip).toBe(1.2);
    // Not measured: the model stands.
    expect(merged.wind).toBe(12);
    expect(merged.humidity).toBe(70);
    // Never measured at all: a station reports quantities, not conditions.
    expect(merged.wmo).toBe(3);
  });

  it('keeps a measured zero, which is a measurement like any other', () => {
    const merged = mergeHour(hour('2026-06-15T10:00', { precip: 2.5 }), {
      time: '2026-06-15T10:00',
      temp: null, tempMin: null, tempMax: null, humidity: null, humidityMin: null, humidityMax: null, dewpoint: null,
      wind: null, gusts: null, windDir: null, radiation: null, precip: 0,
    });
    // A dry hour the gauge actually recorded must beat a modelled 2.5 mm.
    expect(merged.precip).toBe(0);
  });

  it('leaves an hour the station has nothing for exactly as it was', () => {
    const h = hour('2026-06-15T10:00');
    expect(mergeHour(h, undefined)).toBe(h);
  });
});

describe('applyStationObservations', () => {
  it('merges the observed hours and hangs the station off the model', () => {
    const out = applyStationObservations(
      model(),
      observations({
        hours: {
          '2026-06-15T11:00': {
            time: '2026-06-15T11:00', temp: 21, tempMin: 20, tempMax: 22,
            humidity: 55, humidityMin: null, humidityMax: null, dewpoint: 11, wind: 25, gusts: 40, windDir: 200, precip: 0.3, radiation: null,
          },
        },
        current: {
          time: '2026-06-15T12:00', measTime: '2026-06-15T10:42:00Z',
          temp: 23, humidity: 50, dewpoint: 11, wind: 20, gusts: 35, windDir: 210, precip: 0,
        },
      })
    );

    expect(out.pastHours[0]!.temp).toBe(10); // untouched hour
    expect(out.pastHours[1]!.temp).toBe(21);
    expect(out.station!.id).toBe('st1');
    expect(out.station!.name).toBe('Weide');
    // The forecast is not a measurement and stays where it was.
    expect(out.futureHours[0]!.temp).toBe(15);
    // `allHours` is rebuilt, or the strip would draw the merged and unmerged hours.
    expect(out.allHours).toHaveLength(3);
    expect(out.allHours[1]!.temp).toBe(21);
    // What the widget and the notification rules read as "now".
    expect(out.currentTemp).toBe(23);
  });

  it('is a no-op without observations', () => {
    const m = model();
    expect(applyStationObservations(m, null)).toBe(m);
  });
});

describe('recent24', () => {
  it('summarises the last 24 hours, current reading included', () => {
    const hours = Array.from({ length: 30 }, (_, i) =>
      hour(`2026-06-15T${String(i % 24).padStart(2, '0')}:00`, { temp: i, precip: 0.1 })
    );
    const r = recent24(model({ pastHours: hours }));
    // Only the last 24 count, so the six oldest (and coldest) are out of the window.
    expect(r.tempMin).toBe(6);
    expect(r.hours).toBe(24);
    // 24 × 0.1 mm, without the floating-point tail.
    expect(r.precip).toBe(2.4);
    // The hour in progress is part of the day too: the forecast hour's 15 loses to
    // the observed 29, but a hotter now would have won.
    expect(r.tempMax).toBe(29);
  });

  it('prefers the station reading for "now" over the modelled hour', () => {
    const m = applyStationObservations(
      model({ pastHours: [hour('2026-06-15T11:00', { temp: 12 })] }),
      observations({
        current: {
          time: '2026-06-15T12:00', measTime: '2026-06-15T10:42:00Z',
          temp: 31, humidity: null, dewpoint: null,
          wind: null, gusts: null, windDir: null, precip: null,
        },
      })
    );
    // 31 measured, not the model's 15 — a hero must never print a maximum lower
    // than the temperature beside it.
    expect(recent24(m).tempMax).toBe(31);
  });

  it('reports nothing rather than zero when there is no history yet', () => {
    const r = recent24(model({ pastHours: [], futureHours: [] }));
    expect(r.tempMin).toBeNull();
    expect(r.tempMax).toBeNull();
    expect(r.precip).toBe(0);
    expect(r.hours).toBe(0);
  });
});

describe('measurementTimeLabel', () => {
  it('shows the reading\'s own minute in the location\'s zone', () => {
    expect(measurementTimeLabel('2026-06-15T10:42:00Z', 7200)).toBe('12:42');
    expect(measurementTimeLabel('2026-06-15T23:05:00Z', 3600)).toBe('00:05');
    expect(measurementTimeLabel('nonsense', 0)).toBe('');
  });
});

// ── The sync ────────────────────────────────────────────────────────────────────

const place = (id: string, name: string, over: Partial<StationPlace> = {}): StationPlace => ({
  stationId: id, stationName: name, lat: 51.7, lon: 5.3, place: 'Rosmalen', ...over,
});

const prefs = (locations: SavedLocation[], activeLocation = 0): Prefs => ({
  ...DEFAULT_PREFS, locations, activeLocation,
});

describe('syncStationLocations', () => {
  it('creates a location per station, named after the town', () => {
    const out = syncStationLocations(prefs([{ name: 'Eigen plek', lat: 52, lon: 5 }]), [
      place('a', 'Weide noord'),
      place('b', 'Weide zuid', { place: 'Rosmalen' }),
    ]);

    expect(out.locations).toHaveLength(3);
    // The place the user saved is untouched, and stays first.
    expect(out.locations[0]!.name).toBe('Eigen plek');
    // Two stations in one town are two locations: different instruments, different
    // fields, and the reader has to be able to tell which one they are reading.
    expect(out.locations.slice(1).map((l) => l.name)).toEqual(['Rosmalen', 'Rosmalen']);
    expect(out.locations.slice(1).map((l) => l.stationName)).toEqual(['Weide noord', 'Weide zuid']);
    expect(out.locations[1]!.source).toBe('agroexact');
  });

  it('removes the location of a station that left the account', () => {
    const before = prefs([
      { name: 'Eigen plek', lat: 52, lon: 5 },
      { name: 'Rosmalen', lat: 51.7, lon: 5.3, stationId: 'a', stationName: 'Weide', source: 'agroexact' },
    ]);
    const out = syncStationLocations(before, []);
    expect(out.locations).toHaveLength(1);
    expect(out.locations[0]!.name).toBe('Eigen plek');
  });

  it('follows a station that was renamed or moved', () => {
    const before = prefs([
      { name: 'Rosmalen', lat: 51.7, lon: 5.3, stationId: 'a', stationName: 'Oud', source: 'agroexact' },
    ]);
    const out = syncStationLocations(before, [
      place('a', 'Nieuw', { place: 'Berlicum', lat: 51.66, lon: 5.42 }),
    ]);
    expect(out.locations[0]!.stationName).toBe('Nieuw');
    expect(out.locations[0]!.name).toBe('Berlicum');
    expect(out.locations[0]!.lat).toBeCloseTo(51.66, 4);
  });

  it('keeps the reader on the page they were reading', () => {
    const mine: SavedLocation = { name: 'Eigen plek', lat: 52, lon: 5 };
    const before = prefs(
      [
        { name: 'Rosmalen', lat: 51.7, lon: 5.3, stationId: 'a', stationName: 'Weide', source: 'agroexact' },
        mine,
      ],
      1
    );
    // The station location is dropped, so everything shifts one to the left.
    const out = syncStationLocations(before, []);
    expect(out.locations[out.activeLocation]).toBe(mine);
  });

  it('never leaves the app with nowhere to show', () => {
    const out = syncStationLocations(prefs([
      { name: 'Rosmalen', lat: 51.7, lon: 5.3, stationId: 'a', source: 'agroexact' },
    ]), []);
    expect(out.locations).toHaveLength(1);
    expect(out.locations[0]!.source).toBeUndefined();
  });
});

describe('unlinkStationLocations', () => {
  it('keeps the places and drops only the station binding', () => {
    const out = unlinkStationLocations(prefs([
      { name: 'Eigen plek', lat: 52, lon: 5 },
      { name: 'Rosmalen', lat: 51.7, lon: 5.3, stationId: 'a', stationName: 'Weide', source: 'agroexact' },
    ]));
    expect(out.locations).toHaveLength(2);
    const rosmalen = out.locations[1]!;
    // A town does not stop existing because a token did.
    expect(rosmalen.name).toBe('Rosmalen');
    expect(rosmalen.stationId).toBeUndefined();
    expect(rosmalen.source).toBeUndefined();
    expect(out.integrations).toEqual({});
  });
});

describe('stationForLocation', () => {
  const stations = [
    { id: 'a', name: 'Weide', lat: 51.70, lon: 5.31, type: 'ATMO' },
    { id: 'far', name: 'Ver weg', lat: 52.4, lon: 4.9, type: 'ATMO' },
  ];

  it('binds a synced location to its own station, by id', () => {
    const loc: SavedLocation = {
      name: 'Rosmalen', lat: 51.7, lon: 5.3, stationId: 'a', stationName: 'Weide', source: 'agroexact',
    };
    expect(stationForLocation(loc, stations, false)).toEqual({ id: 'a', name: 'Weide' });
    // The binding is stored on the location, so it holds before the list has landed.
    expect(stationForLocation(loc, undefined, false)).toEqual({ id: 'a', name: 'Weide' });
  });

  it('leaves a location the user saved on the model', () => {
    // Standing next to a station is not consent to be measured by it.
    const mine: SavedLocation = { name: 'Eigen plek', lat: 51.7, lon: 5.3 };
    expect(stationForLocation(mine, stations, true)).toBeNull();
  });

  it('lets the device page borrow a nearby station, but only when asked', () => {
    const here: SavedLocation = { name: 'Hier', lat: 51.7, lon: 5.3, current: true };
    expect(stationForLocation(here, stations, false)).toBeNull();
    expect(stationForLocation(here, stations, true)).toEqual({ id: 'a', name: 'Weide' });
  });

  it('will not borrow a station that is too far to speak for the place', () => {
    const here: SavedLocation = { name: 'Hier', lat: 51.0, lon: 4.0, current: true };
    expect(stationForLocation(here, stations, true)).toBeNull();
  });
});
