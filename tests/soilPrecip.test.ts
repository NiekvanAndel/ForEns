/**
 * A soil sensor's rainfall, merged into the rainfall the app already has.
 *
 * Decided in the plan: rain and irrigation are one number. So the risk here is not
 * that the figure goes missing — it is that a green dot ends up behind a modelled
 * figure, or that a sensor with no rain gauge is treated as though it had one.
 */
import { describe, it, expect } from 'vitest';
import { applySoilPrecip, precipIsMeasured, type SoilObservations } from '../core/model/station';
import { modelTiles, type TileLabels } from '../core/model/tiles';
import type { ForecastModel, Hour } from '../core/model/types';
import type { SoilSample } from '../core/sources/agroexact';

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

const model = (): ForecastModel => {
  const past = [hour('2026-06-15T10:00'), hour('2026-06-15T11:00')];
  const future = [hour('2026-06-15T12:00', { isPast: false })];
  return {
    pastHours: past, futureHours: future, allHours: [...past, ...future],
    nowHour: '2026-06-15T12:00', days: [], currentTemp: 15, currentWmo: 3,
    nMembers: 0, hresRunLabel: null, hresHoursByDay: {},
  };
};

const soilHour = (time: string, precip: number | null): SoilSample => ({
  time, measTime: `${time}:00Z`,
  tension: 40, status: 1, pF: null, waterPercent: null,
  refillMm: null, refillToScarceMm: null, soilTemp: null,
  temp10: null, humidity10: null, dewpoint10: null, leafWetProxy: null,
  precip,
});

const obs = (type: string | null, hours: Record<string, SoilSample>): SoilObservations =>
  ({ stationId: 's1', stationName: 'Perceel Noord', type, hours });

describe('a soil sensor with a rain gauge', () => {
  const rain = { '2026-06-15T10:00': soilHour('2026-06-15T10:00', 4.2) };

  it('puts its rainfall into the hours the app already has', () => {
    // One number for rain and irrigation: a field that got 4,2 mm does not care which
    // of them delivered it, and two blocks side by side would ask the reader to add
    // up their own field.
    const out = applySoilPrecip(model(), obs('PLUS', rain));
    expect(out.pastHours[0]!.precip).toBe(4.2);
    expect(out.pastHours[1]!.precip).toBe(0);
    // `allHours` has to follow, or the chart and the blocks disagree about the hour.
    expect(out.allHours[0]!.precip).toBe(4.2);
  });

  it('touches nothing but the rainfall', () => {
    const out = applySoilPrecip(model(), obs('PRO', rain));
    // No thermometer at 1.50 m and no anemometer, so those stay exactly as they were.
    expect(out.pastHours[0]!.temp).toBe(10);
    expect(out.pastHours[0]!.wind).toBe(12);
    expect(out.pastHours[0]!.humidity).toBe(70);
    // And no overlay: that is what the hero reads to put a measurement time beside a
    // temperature, and this sensor has said nothing about the temperature.
    expect(out.station).toBeUndefined();
  });

  it('earns the rainfall blocks their green dot, and only those', () => {
    const merged = applySoilPrecip(model(), obs('PLUS', rain));
    const tiles = modelTiles(merged, labels, null, precipIsMeasured(merged, obs('PLUS', rain)));

    const rainTiles = tiles.filter((t) => t.id.startsWith('rain-') && !t.id.startsWith('rain-next'));
    expect(rainTiles.length).toBeGreaterThan(0);
    expect(rainTiles.every((t) => t.measured)).toBe(true);

    // Everything the sensor cannot answer for stays modelled.
    expect(tiles.find((t) => t.id === 'temp')!.measured).toBe(false);
    expect(tiles.find((t) => t.id === 'wind')!.measured).toBe(false);
    // A forecast is never measured, whatever instrument stands at the location.
    expect(tiles.find((t) => t.id === 'rain-next-1h')!.measured).toBe(false);
    expect(tiles.find((t) => t.id === 'rain-next-24h')!.measured).toBe(false);
  });
});

describe('the same number everywhere it is shown', () => {
  it('feeds the rolling windows, so a block and a comparison row agree', () => {
    // The bug this pins: the comparison sheet built its own model and never ran this
    // merge, so tapping the rainfall block on a field showed one figure on the page
    // and a different one in the list — and the field's row had no green dot while
    // the block it was opened from did.
    const hours = {
      '2026-06-15T10:00': soilHour('2026-06-15T10:00', 4.2),
      '2026-06-15T11:00': soilHour('2026-06-15T11:00', 1.1),
    };
    const soil = obs('PRO', hours);

    const bare = modelTiles(model(), labels, null, false);
    const merged = applySoilPrecip(model(), soil);
    const withSoil = modelTiles(merged, labels, null, precipIsMeasured(merged, soil));

    const sum = (tiles: ReturnType<typeof modelTiles>, id: string) =>
      tiles.find((t) => t.id === id)?.value ?? null;

    // Unmerged the hours are dry, merged they carry what the sensor caught.
    expect(sum(bare, 'rain-24h')).toBe(0);
    expect(sum(withSoil, 'rain-24h')).toBe(5.3);
    expect(sum(withSoil, 'rain-6h')).toBe(5.3);
    // And the dot follows the figure, rather than being decided separately.
    expect(withSoil.find((t) => t.id === 'rain-24h')!.measured).toBe(true);
    expect(bare.find((t) => t.id === 'rain-24h')!.measured).toBe(false);
  });
});

describe('a soil sensor without one', () => {
  const rain = { '2026-06-15T10:00': soilHour('2026-06-15T10:00', 4.2) };

  it('leaves a BASIC out of the rainfall entirely', () => {
    // BASIC is suction only. Even if a precipitation field came back, there is no
    // gauge behind it, and an instrument's dot behind a modelled figure is exactly
    // what the per-quantity merge exists to prevent.
    const m = model();
    const out = applySoilPrecip(m, obs('BASIC', rain));
    expect(out.pastHours[0]!.precip).toBe(0);
    // Untouched, not merely equal: the merge never ran.
    expect(out).toBe(m);
    expect(precipIsMeasured(out, obs('BASIC', rain))).toBe(false);
  });

  it('claims nothing for a model it does not recognise', () => {
    expect(precipIsMeasured(model(), obs(null, rain))).toBe(false);
    expect(precipIsMeasured(model(), obs('CROPEXACT-9000', rain))).toBe(false);
  });

  it('claims nothing when the gauge reported nothing at all', () => {
    // A PLUS whose gauge is silent is not a PLUS that measured zero.
    const silent = { '2026-06-15T10:00': soilHour('2026-06-15T10:00', null) };
    expect(precipIsMeasured(model(), obs('PLUS', silent))).toBe(false);
  });
});

describe('leaving the model alone', () => {
  it('returns the very same object when there is nothing to merge', () => {
    // An unchanged reference keeps the strip from re-rendering every row on a refresh
    // that changed nothing.
    const m = model();
    expect(applySoilPrecip(m, null)).toBe(m);
    expect(applySoilPrecip(m, obs('PLUS', {}))).toBe(m);
    expect(applySoilPrecip(m, obs('BASIC', { '2026-06-15T10:00': soilHour('2026-06-15T10:00', 4.2) }))).toBe(m);
  });

  it('still lets a weather station speak for the rain', () => {
    const m = model();
    const withStation: ForecastModel = {
      ...m,
      station: {
        id: 'w1', name: 'Weide',
        current: {
          time: '2026-06-15T12:00', measTime: '2026-06-15T12:05:00Z',
          temp: 18, humidity: 60, dewpoint: 10, wind: 9, gusts: 14, windDir: 200,
          precip: 1.2,
        },
      },
    };
    expect(precipIsMeasured(withStation, null)).toBe(true);
  });
});
