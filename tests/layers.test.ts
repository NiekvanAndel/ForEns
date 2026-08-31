/**
 * Forecast layer tests.
 *
 * The design's layer switcher is decorative in the mock, so this behaviour is
 * defined here rather than compared against it. What matters is that each layer
 * reads its own measurand, that the scale is shared across days so the column is
 * comparable, and that a half-loaded ensemble degrades rather than crashes.
 */
import { describe, it, expect } from 'vitest';
import { layerRow, LAYERS } from '../core/model/layers';
import type { Day } from '../core/model/types';

function day(over: Partial<Day> = {}): Day {
  return {
    date: '2026-06-15', useHarm: false,
    precipP10: 0, precipP25: 0.5, precipMedian: 2, precipP75: 5, precipP90: 9,
    pChance: 70, p5mm: 30, p20mm: 5,
    tempLo: 11, tempHi: 22,
    tempMaxP10: 18, tempMaxP25: 20, tempMaxP50: 22, tempMaxP75: 24, tempMaxP90: 26,
    tempMinP10: 9, tempMinP25: 10, tempMinP50: 11, tempMinP75: 12, tempMinP90: 13,
    windP10: 12, windP25: 16, windP50: 20, windP75: 26, windP90: 34,
    humidityMedian: 70, humidityP10: 50, humidityP25: 60, humidityP75: 80, humidityP90: 90,
    sunHours: 6.5, et0: 3.2, windDir: 220,
    sunModel: 'ecmwf', sunOpacity: 0.15, sunOpacityDerived: false, sun6Hourly: null,
    dayIcon: 3, wmo: 3, nMembers: 51, ensLoaded: true,
    // Deterministic values, inside the ensemble band. index.html uses IFS
    // unconditionally on days 0–3, so a fixture without these shows nothing there.
    hresTempMax: 22, hresTempMin: 11, hresPrecip: 2, hresWindMax: 20,
    harmTempMax: null, harmTempMin: null, harmPrecip: null, harmWindMax: null,
    harmRhMin: null, harmRhMax: null, hresRhMin: null, hresRhMax: null,
    ...over,
  } as Day;
}

describe('layerRow', () => {
  it('gives every layer a different reading of the same day', () => {
    const d = day();
    const primaries = LAYERS.map((l) => layerRow(d, l.key).primary);
    // Overview and temperature both lead with the maximum, then precipitation,
    // wind, sunshine and humidity.
    expect(primaries).toEqual([22, 22, 2, 20, 6.5, 70]);
  });

  it('flags a value the ensemble median stood in for', () => {
    // An IFS maximum far outside the band, on a day past the forceIfs window.
    const d = day({ hresTempMax: 99, tempMaxP50: 22 });
    const r = layerRow(d, 'temp', true, 9);
    expect(r.primary).toBe(22);
    expect(r.primaryDirect).toBe(false);
  });

  it('keeps the deterministic value when it agrees with the ensemble', () => {
    const r = layerRow(day(), 'temp', true, 9);
    expect(r.primary).toBe(22);
    expect(r.primaryDirect).toBe(true);
  });

  it('prefers the deterministic temperature over the ensemble bounds', () => {
    const r = layerRow(day({ hresTempMax: 25, hresTempMin: 14 }), 'temp');
    expect(r.primary).toBe(25);
    expect(r.secondary).toBe(14);
    expect(r.band).toEqual({ lo: 14, hi: 25 });
    // The whisker still comes from the ensemble.
    expect(r.spread).toEqual({ lo: 9, hi: 26 });
  });

  it('uses the precipitation median, not a mean, and reports the probability', () => {
    const r = layerRow(day(), 'precip');
    expect(r.primary).toBe(2);
    expect(r.band).toEqual({ lo: 0, hi: 2 });
    expect(r.spread).toEqual({ lo: 0, hi: 9 });
    expect(r.note).toBe('70%');
  });

  it('draws no spread for sunshine, which has no ensemble behind it', () => {
    const r = layerRow(day(), 'sun');
    expect(r.primary).toBe(6.5);
    expect(r.secondary).toBe(3.2);
    expect(r.spread).toBeNull();
  });

  it('shows humidity as a range', () => {
    const r = layerRow(day(), 'humidity');
    expect(r.band).toEqual({ lo: 50, hi: 90 });
    expect(r.note).toBe('50–90%');
  });

  it('falls back to deterministic humidity when the ensemble has none', () => {
    const r = layerRow(
      day({ humidityP10: null, humidityP90: null, humidityMedian: null, hresRhMin: 44, hresRhMax: 88 }),
      'humidity'
    );
    expect(r.band).toEqual({ lo: 44, hi: 88 });
    expect(r.primary).toBe(66);
  });

  it('hides every spread when the preference is off', () => {
    for (const l of LAYERS) {
      expect(layerRow(day(), l.key, false).spread, l.key).toBeNull();
    }
  });

  it('treats a rounded-null percentile as absent, not as a real zero', () => {
    // processAll rounds a missing percentile through Math.round(null), which is 0.
    // Before the ensemble lands, a day must render blank rather than "0°" / "0 mm".
    const loading = day({
      ensLoaded: false,
      tempHi: 0, tempLo: 0, precipMedian: 0, windP50: 0, pChance: 0,
      humidityMedian: 0, humidityP10: 0, humidityP90: 0,
      hresTempMax: null, hresTempMin: null, hresPrecip: null, hresWindMax: null,
      hresRhMin: null, hresRhMax: null, harmRhMin: null, harmRhMax: null,
    } as unknown as Partial<Day>);
    expect(layerRow(loading, 'temp').primary).toBeNull();
    expect(layerRow(loading, 'precip').primary).toBe(0);
    expect(layerRow(loading, 'wind').primary).toBeNull();
    // Once it has loaded, a genuine zero is a genuine zero.
    const dry = day({ ensLoaded: true, precipMedian: 0, pChance: 0, hresPrecip: 0 });
    expect(layerRow(dry, 'precip').primary).toBe(0);
    expect(layerRow(dry, 'precip').note).toBe('0%');
  });

  it('hides spread before the ensemble has loaded, but still shows a value', () => {
    const d = day({ ensLoaded: false, hresTempMax: 21, hresTempMin: 12, hresPrecip: 1.4 });
    expect(layerRow(d, 'temp').spread).toBeNull();
    expect(layerRow(d, 'temp').primary).toBe(21);
    expect(layerRow(d, 'precip').note).toBeNull();
  });

  it('survives a day with nothing in it', () => {
    const empty = day({
      precipMedian: null, hresPrecip: null, tempHi: null, tempLo: null,
      hresTempMax: null, hresTempMin: null, windP50: null, hresWindMax: null,
      sunHours: null, et0: null, humidityMedian: null, humidityP10: null,
      humidityP90: null, hresRhMin: null, hresRhMax: null, harmRhMin: null, harmRhMax: null,
    } as unknown as Partial<Day>);
    for (const l of ['overview', 'temp', 'wind', 'sun'] as const) {
      const r = layerRow(empty, l);
      expect(r.primary, l).toBeNull();
      expect(r.band, l).toBeNull();
    }
    // Two layers do not go blank, because index.html does not let them: precipitation
    // falls back to 0 mm rather than to nothing, and humidity to the full 0-100% range.
    // Ported faithfully rather than tidied.
    expect(layerRow(empty, 'precip').primary).toBe(0);
    expect(layerRow(empty, 'humidity').band).toEqual({ lo: 0, hi: 100 });
  });
});
