/**
 * Cumulative radar layer tests.
 *
 * Contract tests against `docs/exactcast-cumulative-radar.md` in AgroExactWebApp, and
 * against the dummy build the front end is developed on. Three things are worth
 * pinning here, because each of them is silent when it goes wrong:
 *
 *  - **The geometry.** A sampling bug does not crash; it reads out a plausible number
 *    from the wrong cell. So the corners and the centre are checked against the
 *    manifest's own bounds, and a point outside the crop has to come back as nothing
 *    rather than as a clamped edge value.
 *  - **The station window.** The layer ends on an anchor that can be over an hour old,
 *    and a gauge total summed to "now" instead would compare a different stretch of
 *    weather with the picture.
 *  - **The dummy build.** It has to stay recognisable as dummy, or a synthetic field
 *    can pass for measured rainfall.
 */
import { describe, it, expect } from 'vitest';
import {
  CumulativeUnavailable, clockAt, coverageOf, decodeValues, formatMm, httpSource,
  legendColorFor, legendStops, overlayBounds, pixelFor, sampleMm, sinceLabel,
  slidingWindows, windowLabel, windowOf,
  type CumulativeWindow,
} from '../core/radar/cumulative';
import { fixtureManifest, fixtureValues } from '../core/radar/fixture';
import { sumPrecipWindow, type PrecipHour } from '../core/sources/agroexact';

const manifest = fixtureManifest;

describe('the dummy fixtures', () => {
  it('are shaped like a real manifest', () => {
    expect(manifest.projection).toBe('EPSG:3857');
    expect(manifest.raster.dtype).toBe('uint16');
    expect(manifest.raster.byte_order).toBe('little');
    expect(manifest.legend.colors.length).toBe(manifest.legend.bounds_mm.length);
    expect(manifest.windows.length).toBe(6);
  });

  it('never pass for measured data', () => {
    // The UI shows a warning off the back of this, and a dummy build that called
    // itself "radar" would put synthetic millimetres on screen as measurements.
    expect(manifest.source).toBe('dummy');
  });

  it('carry the anchor-stamped URLs the server builds, not ones the app invents', () => {
    for (const window of manifest.windows) {
      expect(window.png_url).toContain(`/cumulative/${window.hours}.png`);
      expect(window.png_url).toContain(`anchor=${manifest.anchor}`);
      expect(window.values_url).toContain(`anchor=${manifest.anchor}`);
    }
  });

  it('have a raster per window, sized exactly as the manifest says', () => {
    const cells = manifest.raster.rows * manifest.raster.cols;
    for (const window of manifest.windows) {
      expect(fixtureValues(window.hours).length).toBe(cells);
    }
  });
});

describe('the windows', () => {
  it('all end on the same anchor', () => {
    for (const window of manifest.windows) {
      expect(window.end).toBe(manifest.anchor);
    }
  });

  it('nest: a longer window starts earlier and totals at least as much', () => {
    const ordered = [...manifest.windows].sort((a, b) => a.hours - b.hours);
    for (let i = 1; i < ordered.length; i++) {
      const shorter = ordered[i - 1]!;
      const longer = ordered[i]!;
      expect(new Date(longer.start).getTime()).toBeLessThan(new Date(shorter.start).getTime());
      // The same field with more hours added to it can only grow.
      expect(longer.max_mm).toBeGreaterThanOrEqual(shorter.max_mm);
    }
  });

  it('runs longest first, so the slider s left-hand end is furthest back', () => {
    expect(slidingWindows(manifest).map((w) => w.hours)).toEqual([48, 24, 12, 6, 3, 1]);
  });

  it('starts each window exactly its own length before the anchor', () => {
    const anchorMs = new Date(manifest.anchor).getTime();
    for (const window of manifest.windows) {
      const startMs = new Date(window.start).getTime();
      expect(anchorMs - startMs).toBe(window.hours * 3600_000);
    }
  });

  it('finds a window by length, and answers nothing for one that is not published', () => {
    expect(windowOf(manifest, 24)?.hours).toBe(24);
    expect(windowOf(manifest, 5)).toBeUndefined();
  });
});

describe('coverage', () => {
  it('reports the hours the dummy build deliberately drops', () => {
    // The build bakes in one missing radar hour and one uncalibrated hour, so the
    // warnings the contract asks for have something to render.
    const day = windowOf(manifest, 24)!;
    expect(day.complete).toBe(false);
    expect(coverageOf(day)).toEqual({ missing: 1, uncalibrated: 1 });
  });

  it('reports nothing for a window that is whole', () => {
    expect(coverageOf(windowOf(manifest, 1)!)).toEqual({ missing: 0, uncalibrated: 0 });
  });

  it('never reports negative coverage, however odd the numbers are', () => {
    const odd = { hours_expected: 3, hours_found: 5, hours_calibrated: 9 } as CumulativeWindow;
    expect(coverageOf(odd)).toEqual({ missing: 0, uncalibrated: 0 });
  });
});

describe('placing a coordinate on the raster', () => {
  const bounds = overlayBounds(manifest);

  it('puts the published corners in the corner cells', () => {
    // Inset by a hair: the bounds themselves are the outer edge of the raster, and
    // the north-west corner is exactly the boundary of cell (0, 0).
    const nw = pixelFor(manifest, bounds.north - 0.001, bounds.west + 0.001);
    const se = pixelFor(manifest, bounds.south + 0.001, bounds.east - 0.001);
    expect(nw).toEqual({ row: 0, col: 0 });
    expect(se).toEqual({ row: manifest.raster.rows - 1, col: manifest.raster.cols - 1 });
  });

  it('places the centre of the box near the centre of the raster', () => {
    const midLon = (bounds.west + bounds.east) / 2;
    const at = pixelFor(manifest, 52.3, midLon)!;
    expect(at.col).toBeCloseTo(manifest.raster.cols / 2, -1);
    // Rows are linear in Web Mercator, so the halfway latitude is not the halfway
    // row; it only has to land somewhere sensible in the middle third.
    expect(at.row).toBeGreaterThan(manifest.raster.rows * 0.2);
    expect(at.row).toBeLessThan(manifest.raster.rows * 0.8);
  });

  it('answers nothing outside the crop, rather than clamping to its edge', () => {
    // The crop is tighter than the nowcast layer's, so real saved locations fall
    // outside it — Groningen is inside, the middle of the North Sea is not.
    expect(pixelFor(manifest, 48.0, 5.0)).toBeNull();
    expect(pixelFor(manifest, 52.0, 12.0)).toBeNull();
    expect(pixelFor(manifest, 56.0, 5.0)).toBeNull();
    expect(pixelFor(manifest, 52.0, -1.0)).toBeNull();
  });

  it('reads rows from the north down', () => {
    const north = pixelFor(manifest, bounds.north - 0.01, 5.0)!;
    const south = pixelFor(manifest, bounds.south + 0.01, 5.0)!;
    expect(north.row).toBeLessThan(south.row);
  });
});

describe('sampling a total', () => {
  const values = fixtureValues(24);

  it('reads millimetres, scaled as the manifest says', () => {
    const mm = sampleMm(manifest, values, 52.1, 5.2);
    expect(mm).not.toBeNull();
    expect(mm).toBeGreaterThanOrEqual(0);
    expect(mm).toBeLessThanOrEqual(windowOf(manifest, 24)!.max_mm);
    // Tenths of a millimetre, which is what a scale of 10 leaves.
    expect(Math.round(mm! * 10)).toBeCloseTo(mm! * 10, 6);
  });

  it('never reads above the peak the manifest claims for the window', () => {
    const window = windowOf(manifest, 24)!;
    let peak = 0;
    for (const v of values) peak = Math.max(peak, v);
    const peakMm = peak / manifest.raster.scale;

    // Not equality, deliberately: the fixture rasters are averaged down from the
    // published 836x640 grid, which smooths the single wettest cell away. In
    // production the two are the same number — here the fixture's peak has to stay
    // under the manifest's and in the same weather, which is what catches a raster
    // paired with the wrong window.
    expect(peakMm).toBeLessThanOrEqual(window.max_mm);
    expect(peakMm).toBeGreaterThan(window.max_mm * 0.7);
  });

  it('answers nothing off the crop', () => {
    expect(sampleMm(manifest, values, 48.0, 5.0)).toBeNull();
  });

  it('answers nothing rather than reading past the end of a short raster', () => {
    expect(sampleMm(manifest, new Uint16Array(4), 52.1, 5.2)).toBeNull();
  });

  it('grows with the window, because the windows nest', () => {
    const hour = sampleMm(manifest, fixtureValues(1), 52.1, 5.2)!;
    const day = sampleMm(manifest, fixtureValues(24), 52.1, 5.2)!;
    const two = sampleMm(manifest, fixtureValues(48), 52.1, 5.2)!;
    expect(day).toBeGreaterThanOrEqual(hour);
    expect(two).toBeGreaterThanOrEqual(day);
  });
});

describe('the legend', () => {
  it('is built from the manifest, ramp and all', () => {
    const stops = legendStops(manifest.legend);
    expect(stops.length).toBe(manifest.legend.colors.length);
    expect(stops[0]!.from).toBe(manifest.legend.bounds_mm[0]);
    expect(stops[0]!.color).toBe(manifest.legend.colors[0]);
    // The last class is open-ended: there is no upper bound on rainfall.
    expect(stops[stops.length - 1]!.to).toBeNull();
  });

  it('leaves dry ground uncoloured', () => {
    expect(legendColorFor(manifest.legend, 0)).toBeNull();
    expect(legendColorFor(manifest.legend, manifest.legend.dry_below_mm - 0.01)).toBeNull();
  });

  it('colours a total with the class it falls in', () => {
    const { bounds_mm, colors } = manifest.legend;
    expect(legendColorFor(manifest.legend, bounds_mm[0]!)).toBe(colors[0]);
    expect(legendColorFor(manifest.legend, bounds_mm[2]! + 0.1)).toBe(colors[2]);
    // Above the top bound it stays in the top class rather than falling off the end.
    expect(legendColorFor(manifest.legend, 500)).toBe(colors[colors.length - 1]);
  });
});

describe('labels', () => {
  const window = windowOf(manifest, 24)!;

  it('names the window as a duration', () => {
    expect(windowLabel(1)).toBe('1 uur');
    expect(windowLabel(48)).toBe('48 uur');
  });

  it('says when the counting started, in days a reader recognises', () => {
    // Local time, as the rest of the map's clocks are.
    const start = new Date(window.start);
    const sameDay = new Date(start.getTime() + 6 * 3600_000);
    expect(sinceLabel(window, sameDay)).toMatch(/^sinds \d\d:\d\d$/);
    const nextDay = new Date(start.getTime() + 30 * 3600_000);
    expect(sinceLabel(window, nextDay)).toMatch(/^sinds gisteren \d\d:\d\d$/);
    const later = new Date(start.getTime() + 5 * 86_400_000);
    expect(sinceLabel(window, later)).toMatch(/^sinds \d\d-\d\d \d\d:\d\d$/);
  });

  it('prints a clock for the anchor, so nothing has to call it "now"', () => {
    expect(clockAt(manifest.anchor)).toMatch(/^\d\d:\d\d$/);
    expect(clockAt('not a time')).toBe('--:--');
  });

  it('prints millimetres the Dutch way, to the tenth the raster carries', () => {
    expect(formatMm(39.4)).toBe('39,4 mm');
    expect(formatMm(0)).toBe('0,0 mm');
  });
});

describe('decoding a value raster', () => {
  it('reads little-endian uint16', () => {
    const bytes = new Uint8Array([0x94, 0x01, 0x00, 0x00]).buffer;
    expect(Array.from(decodeValues(bytes))).toEqual([404, 0]);
  });

  it('refuses bytes that are not whole uint16s', () => {
    expect(() => decodeValues(new Uint8Array([1, 2, 3]).buffer)).toThrow(/not whole uint16/);
  });

  it('refuses a raster the contract does not describe', () => {
    expect(() => decodeValues(new Uint8Array([1, 2]).buffer, 'float32')).toThrow(/dtype/);
  });
});

describe('the live source', () => {
  const window = manifest.windows[0]!;

  function sourceWith(response: Partial<Response> & { status: number }) {
    const fetchImpl = (async () => ({
      headers: new Headers(),
      json: async () => manifest,
      arrayBuffer: async () => new Uint8Array([1, 0]).buffer,
      ok: response.status >= 200 && response.status < 300,
      ...response,
    })) as unknown as typeof fetch;
    return httpSource({ baseUrl: 'https://example.test', token: async () => 't', fetchImpl });
  }

  it('reports "not built yet" as its own state, with the wait the server asked for', async () => {
    const source = sourceWith({
      status: 503,
      headers: new Headers({ 'Retry-After': '90' }),
    });
    await expect(source.manifest()).rejects.toBeInstanceOf(CumulativeUnavailable);
    await source.manifest().catch((e: CumulativeUnavailable) => {
      expect(e.retryAfterSec).toBe(90);
    });
  });

  it('falls back to a minute when the server names no wait', async () => {
    const source = sourceWith({ status: 503 });
    await source.manifest().catch((e: CumulativeUnavailable) => {
      expect(e.retryAfterSec).toBe(60);
    });
  });

  it('draws the URL the manifest gave it, stamp and all', () => {
    const source = sourceWith({ status: 200 });
    expect(source.overlayUrl(window)).toBe(window.png_url);
  });

  it('passes a manifest through untouched', async () => {
    const source = sourceWith({ status: 200 });
    expect(await source.manifest()).toEqual(manifest);
  });

  it('treats anything else as a failure', async () => {
    const source = sourceWith({ status: 500 });
    await expect(source.manifest()).rejects.toThrow(/HTTP 500/);
  });
});

describe('a station total over the layer s window', () => {
  const anchorMs = Date.UTC(2026, 8, 15, 12, 0);
  const hour = 3600_000;

  /** Rows as the API stamps them: at the end of the hour they cover. */
  const rows: PrecipHour[] = [
    { endMs: anchorMs - 3 * hour, precip: 5 },
    { endMs: anchorMs - 2 * hour, precip: 1.5 },
    { endMs: anchorMs - hour, precip: 0 },
    { endMs: anchorMs, precip: 2.5 },
  ];

  it('counts the hour stamped at the anchor and excludes the one at the start', () => {
    // A row at the anchor covers the hour that ends there, so it is inside a window
    // ending there. A row stamped at the window's start covers the hour before it.
    expect(sumPrecipWindow(rows, anchorMs, 3)).toEqual({
      mm: 4, hoursFound: 3, hoursExpected: 3,
    });
  });

  it('sums only the newest hour for the shortest window', () => {
    expect(sumPrecipWindow(rows, anchorMs, 1)).toEqual({
      mm: 2.5, hoursFound: 1, hoursExpected: 1,
    });
  });

  it('ignores anything after the anchor, which is not in the window at all', () => {
    const withFuture = [...rows, { endMs: anchorMs + hour, precip: 40 }];
    expect(sumPrecipWindow(withFuture, anchorMs, 3).mm).toBe(4);
  });

  it('counts an hour the station did not report as missing, not as dry', () => {
    const gappy = [...rows.slice(0, 3), { endMs: anchorMs, precip: null }];
    const sum = sumPrecipWindow(gappy, anchorMs, 3);
    expect(sum.hoursFound).toBe(2);
    expect(sum.hoursExpected).toBe(3);
    // Which is what makes the read-out fall back to the raster rather than print a
    // total that is short by an unknown amount.
    expect(sum.hoursFound).toBeLessThan(sum.hoursExpected);
  });

  it('reports nothing found when the station has no rows at all', () => {
    expect(sumPrecipWindow([], anchorMs, 24)).toEqual({
      mm: 0, hoursFound: 0, hoursExpected: 24,
    });
  });

  it('moves with the anchor, which is why it is summed over one and not over now', () => {
    // The anchor can be over an hour behind the wall clock, and an hour of rain is
    // an hour of rain: the same rows over a window shifted by 70 minutes are a
    // different total, and only the one ending on the anchor belongs beside the map.
    const stale = anchorMs - 70 * 60_000;
    expect(sumPrecipWindow(rows, anchorMs, 1).mm).toBe(2.5);
    expect(sumPrecipWindow(rows, stale, 1).mm).toBe(1.5);
  });
});
