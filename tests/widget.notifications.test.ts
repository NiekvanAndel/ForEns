/**
 * Widget payload, condition symbols, and notification planning.
 *
 * The widget cannot run the app's TypeScript, so the payload is the whole contract
 * between them. These tests are what stop it drifting.
 */
import { describe, it, expect } from 'vitest';
import { buildWidgetPayload, WIDGET_PAYLOAD_VERSION } from '../core/widget';
import { wmoSymbol, wmoCondition, symbolLayers } from '../core/model/conditions';
import {
  planNotification, inQuietHours, afterQuietHours,
  QUIET_START_HOUR, QUIET_END_HOUR,
} from '../core/notifications';
import { DEFAULT_PREFS, type Prefs, type SavedLocation } from '../core/prefs';
import type { ForecastModel, Day, Hour } from '../core/model/types';
import type { WeatherAlert } from '../core/model/alert';

const hour = (time: string, over: Partial<Hour> = {}): Hour => ({
  time, temp: 18, precip: 0, wind: 14, humidity: 68, wmo: 2,
  isDay: 1, isPast: false, gusts: 20, windDir: 200, sunMin: 30, ...over,
});

const day = (date: string, over: Partial<Day> = {}): Day => ({
  date, useHarm: false,
  precipP10: 0, precipP25: 0, precipMedian: 1.2, precipP75: 3, precipP90: 6,
  pChance: 50, p5mm: 20, p20mm: 2,
  tempLo: 11, tempHi: 22,
  tempMaxP10: 19, tempMaxP25: 20, tempMaxP50: 22, tempMaxP75: 23, tempMaxP90: 25,
  tempMinP10: 9, tempMinP25: 10, tempMinP50: 11, tempMinP75: 12, tempMinP90: 13,
  windP10: 10, windP25: 14, windP50: 18, windP75: 22, windP90: 28,
  humidityMedian: 70, humidityP10: 55, humidityP25: 62, humidityP75: 80, humidityP90: 88,
  sunHours: 5, et0: 3, windDir: 200,
  sunModel: 'ecmwf', sunOpacity: 0.15, sunOpacityDerived: false, sun6Hourly: null,
  dayIcon: 2, wmo: 2, nMembers: 51, ensLoaded: true,
  hresTempMax: 22, hresTempMin: 11,
  harmTempMax: null, harmTempMin: null, harmPrecip: null, harmWindMax: null,
  harmRhMin: null, harmRhMax: null, hresRhMin: null, hresRhMax: null,
  ...over,
} as Day);

const model: ForecastModel = {
  pastHours: [hour('2026-06-15T10:00', { isPast: true, precip: 0.5 })],
  futureHours: [
    hour('2026-06-15T12:00'),
    hour('2026-06-15T13:00', { precip: 1.4, wmo: 61 }),
    hour('2026-06-15T14:00'),
  ],
  allHours: [],
  nowHour: '2026-06-15T12:00',
  days: [day('2026-06-15'), day('2026-06-16', { hresTempMax: 28, hresTempMin: 15 })],
  currentTemp: 18, currentWmo: 2, nMembers: 51,
  hresRunLabel: 'IFS 06z', hresHoursByDay: {},
};

const location: SavedLocation = { name: "'s-Hertogenbosch", lat: 51.6978, lon: 5.3037 };

describe('buildWidgetPayload', () => {
  it('pre-formats every value, so the widget lays out strings only', () => {
    const p = buildWidgetPayload({ model, prefs: DEFAULT_PREFS, location });
    expect(p.version).toBe(WIDGET_PAYLOAD_VERSION);
    expect(p.temp).toBe('18°');
    expect(p.high).toBe('22°');
    expect(p.low).toBe('11°');
    expect(p.windUnit).toBe('km/u');
    // Comma decimals, per the design system's number rules.
    expect(p.precip24).toContain(',');
    expect(p.hours[0]!.mm).toBe('0,0');
  });

  it('follows the user units, so a Swift change is never needed for them', () => {
    const f: Prefs = { ...DEFAULT_PREFS, tempUnit: 'F', windUnit: 'bft' };
    const p = buildWidgetPayload({ model, prefs: f, location });
    expect(p.temp).toBe('64°');
    expect(p.windUnit).toBe('Bft');
  });

  it('marks a station-backed location, which is the only green in the design', () => {
    expect(buildWidgetPayload({ model, prefs: DEFAULT_PREFS, location }).station).toBe(false);
    const withStation = { ...location, stationId: 'st1', stationName: 'Rosmalen' };
    const p = buildWidgetPayload({ model, prefs: DEFAULT_PREFS, location: withStation });
    expect(p.station).toBe(true);
    expect(p.stationName).toBe('Rosmalen');
  });

  it('carries an alert headline when there is one', () => {
    const alert: WeatherAlert = {
      kind: 'wind', severity: 'heavy', icon: 'wind', label: 'Wind',
      headline: 'Zware windstoten tot 80 km/u', sub: '…', bars: [4, 4, 4, 4],
    };
    const p = buildWidgetPayload({ model, prefs: DEFAULT_PREFS, location, alert });
    expect(p.alertKind).toBe('wind');
    expect(p.alertHeadline).toContain('80');
  });

  it('scales the day bars across all days shown, not per row', () => {
    const p = buildWidgetPayload({ model, prefs: DEFAULT_PREFS, location });
    // Day 2 is warmer, so its bar must sit further right than day 1's.
    expect(p.days[1]!.barLeft).toBeGreaterThan(p.days[0]!.barLeft);
    for (const d of p.days) {
      expect(d.barLeft).toBeGreaterThanOrEqual(0);
      expect(d.barLeft + d.barWidth).toBeLessThanOrEqual(1.001);
    }
  });

  it('serialises to JSON without losing anything', () => {
    const p = buildWidgetPayload({ model, prefs: DEFAULT_PREFS, location });
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });

  it('survives a model with almost nothing in it', () => {
    const bare: ForecastModel = {
      ...model, pastHours: [], futureHours: [], days: [],
    };
    const p = buildWidgetPayload({ model: bare, prefs: DEFAULT_PREFS, location });
    expect(p.temp).toBe('—');
    expect(p.days).toEqual([]);
    expect(p.hours).toEqual([]);
  });
});

describe('wmoSymbol', () => {
  it('distinguishes what Phosphor could not', () => {
    // The point of the swap: drizzle, rain and heavy rain are three glyphs now.
    expect(wmoSymbol(51)).toBe('cloud.drizzle.fill');
    expect(wmoSymbol(61)).toBe('cloud.rain.fill');
    expect(wmoSymbol(65)).toBe('cloud.heavyrain.fill');
    expect(wmoSymbol(66)).toBe('cloud.sleet.fill');
    expect(wmoSymbol(95)).toBe('cloud.bolt.rain.fill');
  });

  it('draws night rather than merely tinting it', () => {
    expect(wmoSymbol(0, true)).toBe('sun.max.fill');
    expect(wmoSymbol(0, false)).toBe('moon.stars.fill');
    expect(wmoSymbol(2, false)).toBe('cloud.moon.fill');
    expect(wmoSymbol(80, false)).toBe('cloud.moon.rain.fill');
  });

  it('gives every WMO code index.html reports a symbol', () => {
    const codes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 61, 63, 65, 71, 73, 75, 80, 81, 82, 95, 96, 99];
    for (const c of codes) {
      for (const day of [true, false]) {
        const s = wmoSymbol(c, day);
        expect(s, `code ${c}`).toBeTruthy();
        // SF Symbols names are dotted lowercase; a typo usually shows up as spaces.
        expect(s, `code ${c}`).toMatch(/^[a-z0-9.]+$/);
      }
    }
  });

  it('falls back rather than returning nothing for an unknown code', () => {
    expect(wmoSymbol(1234)).toBe('cloud.fill');
  });

  it('maps codes to stable condition keys', () => {
    expect(wmoCondition(0)).toBe('clear');
    expect(wmoCondition(65)).toBe('heavy-rain');
    expect(wmoCondition(99)).toBe('thunderstorm-hail');
    expect(wmoCondition(95)).toBe('thunderstorm');
  });
});

describe('quiet hours', () => {
  const at = (h: number) => Date.UTC(2026, 5, 15, h, 0, 0);

  it('covers the window that wraps midnight', () => {
    expect(inQuietHours(at(23))).toBe(true);
    expect(inQuietHours(at(3))).toBe(true);
    expect(inQuietHours(at(QUIET_START_HOUR))).toBe(true);
    expect(inQuietHours(at(QUIET_END_HOUR))).toBe(false);
    expect(inQuietHours(at(12))).toBe(false);
  });

  it('pushes a late-evening moment to the next morning', () => {
    const pushed = afterQuietHours(at(23));
    expect(new Date(pushed).getUTCHours()).toBe(QUIET_END_HOUR);
    expect(new Date(pushed).getUTCDate()).toBe(16);
  });

  it('pushes an early-morning moment to later the same day', () => {
    const pushed = afterQuietHours(at(3));
    expect(new Date(pushed).getUTCHours()).toBe(QUIET_END_HOUR);
    expect(new Date(pushed).getUTCDate()).toBe(15);
  });

  it('leaves a daytime moment alone', () => {
    expect(afterQuietHours(at(14))).toBe(at(14));
  });

  it('respects the local offset, not UTC', () => {
    // 23:00 in UTC+2 is 21:00 UTC, which is still inside quiet hours locally.
    expect(inQuietHours(Date.UTC(2026, 5, 15, 21, 0), 7200)).toBe(true);
    expect(inQuietHours(Date.UTC(2026, 5, 15, 21, 0), 0)).toBe(false);
  });
});

describe('planNotification', () => {
  const noon = Date.UTC(2026, 5, 15, 12, 0);
  const alert = (over: Partial<WeatherAlert> = {}): WeatherAlert => ({
    kind: 'rain', severity: 'light', icon: 'cloud-rain', label: 'Neerslag',
    headline: 'Regen over 30 minuten', sub: 'Naar verwachting 2,0 mm.',
    bars: [4, 20, 40, 4], ...over,
  });

  it('says nothing without an alert', () => {
    expect(planNotification(null, DEFAULT_PREFS, { locationName: 'X' })).toBeNull();
  });

  it('respects the per-kind preference', () => {
    const off = { ...DEFAULT_PREFS, notifyRain: false };
    expect(planNotification(alert(), off, { locationName: 'X', nowMs: noon })).toBeNull();
    const on = { ...DEFAULT_PREFS, notifyRain: true };
    expect(planNotification(alert(), on, { locationName: 'X', nowMs: noon })).not.toBeNull();
  });

  it('routes a storm through the rain preference', () => {
    const on = { ...DEFAULT_PREFS, notifyRain: true, notifyWind: false };
    expect(planNotification(alert({ kind: 'storm' }), on, { locationName: 'X', nowMs: noon })).not.toBeNull();
  });

  it('never notifies for kinds with no preference behind them', () => {
    const all = { ...DEFAULT_PREFS, notifyRain: true, notifyWind: true, notifyFrost: true };
    expect(planNotification(alert({ kind: 'fog' }), all, { locationName: 'X', nowMs: noon })).toBeNull();
    expect(planNotification(alert({ kind: 'heat' }), all, { locationName: 'X', nowMs: noon })).toBeNull();
  });

  it('names the location, since alerts are per place', () => {
    const on = { ...DEFAULT_PREFS, notifyRain: true };
    const p = planNotification(alert(), on, { locationName: 'Westkapelle', nowMs: noon })!;
    expect(p.title).toContain('Westkapelle');
    expect(p.body).toContain('Regen over 30 minuten');
  });

  it('drops an alert that quiet hours would delay past its usefulness', () => {
    // A shower at 23:00 held until 07:00 would announce rain that already fell.
    const on = { ...DEFAULT_PREFS, notifyRain: true, quietHours: true };
    const lateNight = Date.UTC(2026, 5, 15, 23, 0);
    expect(planNotification(alert(), on, { locationName: 'X', nowMs: lateNight })).toBeNull();
  });

  it('fires immediately at night when quiet hours are off', () => {
    const on = { ...DEFAULT_PREFS, notifyRain: true, quietHours: false };
    const lateNight = Date.UTC(2026, 5, 15, 23, 0);
    const p = planNotification(alert(), on, { locationName: 'X', nowMs: lateNight })!;
    expect(p.atMs).toBe(lateNight);
  });

  it('keys on kind and hour so a refresh does not re-notify the same event', () => {
    const on = { ...DEFAULT_PREFS, notifyRain: true };
    const a = planNotification(alert(), on, { locationName: 'X', nowMs: noon })!;
    const b = planNotification(alert(), on, { locationName: 'X', nowMs: noon + 60_000 })!;
    expect(a.id).toBe(b.id);
    const later = planNotification(alert(), on, { locationName: 'X', nowMs: noon + 3600_000 })!;
    expect(later.id).not.toBe(a.id);
  });
});

describe('symbolLayers', () => {
  it('does not call a lone sun a cloud', () => {
    // The bug this exists to prevent: palette rendering colours layers by position,
    // so assuming layer one is a cloud painted clear days grey.
    expect(symbolLayers(0, true)).toEqual(['sun']);
    expect(symbolLayers(1, true)).toEqual(['sun']);
  });

  it('reads a composite symbol in the order Apple names it', () => {
    expect(symbolLayers(2, true)).toEqual(['cloud', 'sun']);
    expect(symbolLayers(80, true)).toEqual(['cloud', 'sun', 'precip']);
    expect(symbolLayers(95)).toEqual(['cloud', 'storm', 'precip']);
  });

  it('names the moon and its stars as the layers they are', () => {
    expect(symbolLayers(0, false)).toEqual(['moon', 'stars']);
    expect(symbolLayers(2, false)).toEqual(['cloud', 'moon']);
  });

  it('treats fog as part of its cloud', () => {
    expect(symbolLayers(45)).toEqual(['cloud', 'cloud']);
  });

  it('handles a symbol that is only weather, with no cloud at all', () => {
    expect(symbolLayers(75)).toEqual(['snow']);
  });

  it('names a layer for every drawn element of every condition', () => {
    // A symbol whose layers outnumber the roles would leave a layer uncoloured.
    for (const code of [0, 1, 2, 3, 45, 48, 51, 55, 61, 65, 71, 75, 80, 82, 85, 95, 99]) {
      for (const day of [true, false]) {
        const parts = wmoSymbol(code, day)
          .split('.')
          .filter((p) => p !== 'fill' && p !== 'max');
        expect(symbolLayers(code, day), `${code}/${day}`).toHaveLength(parts.length);
      }
    }
  });
});

describe('cloudless symbols keep their own colours', () => {
  // The light-mode palette exists only to stop a white cloud vanishing on cream.
  // A symbol with no cloud has nothing to fix, and treating it as if it did is what
  // put the sun out — first grey, then blue.
  it('a clear day has no cloud layer to grey', () => {
    for (const code of [0, 1, 75, 86]) {
      expect(symbolLayers(code, true).includes('cloud'), String(code)).toBe(false);
    }
  });

  it('everything overcast or raining does have one', () => {
    for (const code of [2, 3, 45, 51, 61, 65, 71, 80, 95, 99]) {
      expect(symbolLayers(code, true).includes('cloud'), String(code)).toBe(true);
    }
  });
});
