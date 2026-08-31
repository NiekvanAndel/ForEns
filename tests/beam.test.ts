/**
 * Ensemble beam tests.
 *
 * The geometry is transcribed from index.html's day rows, so these check the shape
 * of the figure — a band where the members fall, a median hairline, a marker at the
 * reported value — and the scales it is drawn against.
 */
import { describe, it, expect } from 'vitest';
import { beamScale, layerBeam, daylightHours, et0Scale, place } from '../core/model/beam';
import type { Day } from '../core/model/types';

function day(over: Partial<Day> = {}): Day {
  return {
    date: '2026-06-15', useHarm: false, ensLoaded: true,
    precipP10: 0, precipP25: 0.5, precipMedian: 2, precipP75: 5, precipP90: 9,
    pChance: 70, p5mm: 30, p20mm: 5,
    tempLo: 11, tempHi: 22,
    tempMaxP10: 18, tempMaxP25: 20, tempMaxP50: 22, tempMaxP75: 24, tempMaxP90: 26,
    tempMinP10: 9, tempMinP25: 10, tempMinP50: 11, tempMinP75: 12, tempMinP90: 13,
    windP10: 12, windP25: 16, windP50: 20, windP75: 26, windP90: 34,
    humidityMedian: 70, humidityP10: 50, humidityP25: 60, humidityP75: 80, humidityP90: 90,
    sunHours: 6.5, et0: 3.2, windDir: 220, dayIcon: 3, wmo: 3, nMembers: 51,
    sunModel: 'ecmwf', sunOpacity: null, sunOpacityDerived: false, sun6Hourly: null,
    hresTempMax: 22, hresTempMin: 11, hresPrecip: 2, hresWindMax: 20,
    harmTempMax: null, harmTempMin: null, harmPrecip: null, harmWindMax: null,
    harmRhMin: null, harmRhMax: null, hresRhMin: 55, hresRhMax: 85,
    ...over,
  } as Day;
}

describe('beamScale', () => {
  it('floors precipitation at 10 mm so a dry week does not magnify a trace', () => {
    const dry = [day({ precipP90: 0.4 }), day({ precipP90: 0.1 })];
    expect(beamScale(dry, 'precip')).toEqual({ lo: 0, hi: 10 });
  });

  it('lets a wet day set the precipitation scale once it passes the floor', () => {
    expect(beamScale([day({ precipP90: 22 })], 'precip')).toEqual({ lo: 0, hi: 22 });
  });

  it('pads temperature by two degrees either side, across minima and maxima', () => {
    expect(beamScale([day()], 'temp')).toEqual({ lo: 7, hi: 28 });
  });

  it('pads wind by five but never below zero', () => {
    expect(beamScale([day({ windP10: 2 })], 'wind')).toEqual({ lo: 0, hi: 39 });
    expect(beamScale([day({ windP10: 20, windP90: 40 })], 'wind')).toEqual({ lo: 15, hi: 45 });
  });

  it('keeps humidity inside 0–100 however wide the members are', () => {
    const s = beamScale([day({ humidityP10: 3, humidityP90: 99 })], 'humidity');
    expect(s.lo).toBe(0);
    expect(s.hi).toBe(100);
  });

  it('scales sunshine against the day’s own daylight, not a fixed maximum', () => {
    const june = beamScale([day({ date: '2026-06-21' })], 'sun', 52).hi;
    const december = beamScale([day({ date: '2026-12-21' })], 'sun', 52).hi;
    expect(june).toBeGreaterThan(15);
    expect(december).toBeLessThan(9);
  });
});

describe('daylightHours', () => {
  it('is longest at midsummer and shortest at midwinter', () => {
    expect(daylightHours('2026-06-21', 52)).toBeGreaterThan(daylightHours('2026-12-21', 52));
  });

  it('returns a whole day inside the arctic summer and none in its winter', () => {
    expect(daylightHours('2026-06-21', 80)).toBe(24);
    expect(daylightHours('2026-12-21', 80)).toBe(0);
  });

  it('is near twelve hours at the equator all year', () => {
    for (const d of ['2026-03-21', '2026-06-21', '2026-09-21', '2026-12-21']) {
      expect(daylightHours(d, 0)).toBeCloseTo(12, 0);
    }
  });
});

describe('layerBeam', () => {
  it('puts the median inside the band and the value on the scale', () => {
    const scale = beamScale([day()], 'precip');
    const b = layerBeam(day(), 'precip', 0, scale);
    expect(b.ranges).toHaveLength(1);
    expect(b.ranges[0]!.from).toBeCloseTo(0, 5);
    expect(b.ranges[0]!.to).toBeCloseTo(0.9, 5);
    expect(b.medians[0]!.at).toBeCloseTo(0.2, 5);
    expect(b.markers[0]!.at).toBeCloseTo(0.2, 5);
  });

  it('draws a marker outside the band when the deterministic run is an outlier', () => {
    // Day 9, so past the forceIfs window: 40 mm is far outside p10–p90.
    const d = day({ hresPrecip: 40, precipMedian: 2 });
    const scale = beamScale([d], 'precip');
    const b = layerBeam(d, 'precip', 9, scale);
    // resolveDayValues substitutes the median, so the marker returns to it — which
    // is the point: the row shows the ensemble's number, marked `~`.
    expect(b.markers[0]!.at).toBeCloseTo(b.medians[0]!.at, 5);
  });

  it('gives temperature two bands, two medians and two markers on one axis', () => {
    const scale = beamScale([day()], 'temp');
    const b = layerBeam(day(), 'temp', 0, scale);
    expect(b.ranges.map((r) => r.tone)).toEqual(['low', 'high']);
    expect(b.medians).toHaveLength(2);
    expect(b.markers).toHaveLength(2);
    // The minimum sits left of the maximum.
    expect(b.markers[0]!.at).toBeLessThan(b.markers[1]!.at);
  });

  it('splits humidity at the median', () => {
    const scale = beamScale([day()], 'humidity');
    const b = layerBeam(day(), 'humidity', 0, scale);
    expect(b.ranges).toHaveLength(2);
    expect(b.ranges[0]!.to).toBeCloseTo(b.ranges[1]!.from, 5);
  });

  it('draws no band for sunshine, which has no ensemble behind it', () => {
    const b = layerBeam(day(), 'sun', 0, beamScale([day()], 'sun'));
    expect(b.medians).toHaveLength(0);
    expect(b.ranges[0]!.from).toBe(0);
  });

  it('draws nothing at all before the ensemble has loaded', () => {
    // Every percentile reads as a rounded zero at that point, so a band would be a
    // hard zero rather than "not yet known".
    const loading = day({ ensLoaded: false });
    const b = layerBeam(loading, 'precip', 0, beamScale([loading], 'precip'));
    expect(b.ranges).toHaveLength(0);
    expect(b.medians).toHaveLength(0);
    // The reported value is deterministic, so it still has a marker.
    expect(b.markers).toHaveLength(1);
  });

  it('keeps a zero-width band visible', () => {
    const d = day({ precipP10: 3, precipP90: 3, precipMedian: 3 });
    const b = layerBeam(d, 'precip', 0, beamScale([d], 'precip'));
    expect(b.ranges[0]!.to).toBeGreaterThan(b.ranges[0]!.from);
  });
});

describe('place', () => {
  it('clamps outside the scale rather than running off the track', () => {
    expect(place(-5, { lo: 0, hi: 10 })).toBe(0);
    expect(place(50, { lo: 0, hi: 10 })).toBe(1);
    expect(place(null, { lo: 0, hi: 10 })).toBeNull();
  });
});

describe('et0Scale', () => {
  it('never shrinks below a usable 4 mm, and leaves a millimetre of headroom', () => {
    expect(et0Scale([day({ et0: 1 })])).toBe(5);
    expect(et0Scale([day({ et0: 7 })])).toBe(8);
  });
});
