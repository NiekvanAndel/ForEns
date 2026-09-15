/**
 * Bubble placement and the precedence between locations.
 *
 * Worth pinning because the failure modes are quiet ones. A projection that is subtly
 * wrong does not crash; it hides a bubble that had room and draws two on top of each
 * other. And the rule that settles an overlap — the reader's own list order — is the
 * kind of thing a later sort, added for a good reason somewhere else, silently
 * reverses.
 */
import { describe, it, expect } from 'vitest';
import {
  bubbleDiameter, bubbleText, layoutBubbles, screenPointFor,
  type BubbleCandidate, type MapView,
} from '../core/radar/bubbles';
import { readingFor, seriesFor } from '../core/radar/reading';
import { fixtureManifest, fixtureValues } from '../core/radar/fixture';
import { slidingWindows, windowOf } from '../core/radar/cumulative';
import type { PrecipHour } from '../core/sources/agroexact';

const view: MapView = {
  center: [5.2, 52.1],
  zoom: 7,
  width: 390,
  height: 600,
};

function candidate(over: Partial<BubbleCandidate> & { key: string }): BubbleCandidate {
  return {
    lat: 52.1, lon: 5.2, mm: 5, priority: 0, selected: false, ...over,
  };
}

describe('projecting a coordinate onto the map', () => {
  it('puts the centre of the map in the centre of the viewport', () => {
    const at = screenPointFor(view, view.center[1], view.center[0]);
    expect(at.x).toBeCloseTo(view.width / 2, 6);
    expect(at.y).toBeCloseTo(view.height / 2, 6);
  });

  it('puts north up and east right', () => {
    const north = screenPointFor(view, 53, 5.2);
    const east = screenPointFor(view, 52.1, 6);
    expect(north.y).toBeLessThan(view.height / 2);
    expect(east.x).toBeGreaterThan(view.width / 2);
  });

  it('spreads the same two points further apart as the map zooms in', () => {
    const near = screenPointFor(view, 52.2, 5.2);
    const far = screenPointFor({ ...view, zoom: 9 }, 52.2, 5.2);
    const nearOffset = Math.abs(near.y - view.height / 2);
    const farOffset = Math.abs(far.y - view.height / 2);
    // Two zoom levels is four times the distance, which is what makes bubbles that
    // overlapped at country scale fit once the reader zooms in.
    expect(farOffset / nearOffset).toBeCloseTo(4, 1);
  });

  it('survives a location at the pole rather than returning NaN', () => {
    const at = screenPointFor(view, 90, 5.2);
    expect(Number.isFinite(at.x)).toBe(true);
    expect(Number.isFinite(at.y)).toBe(true);
  });
});

describe('bubble size', () => {
  it('grows with zoom, between fixed ends', () => {
    const out = bubbleDiameter(4);
    const mid = bubbleDiameter(8);
    const far = bubbleDiameter(14);
    expect(out).toBeLessThan(mid);
    expect(mid).toBeLessThan(far);
    // Clamped at both ends, so a bubble never shrinks past legibility or grows to
    // cover the town it belongs to.
    expect(bubbleDiameter(1)).toBe(out);
    expect(bubbleDiameter(20)).toBe(far);
  });
});

describe('resolving overlaps', () => {
  it('draws a bubble for a location on its own', () => {
    const { shown, hidden } = layoutBubbles([candidate({ key: 'a' })], view);
    expect(shown.map((b) => b.key)).toEqual(['a']);
    expect(hidden).toHaveLength(0);
  });

  it('gives the overlap to the location higher up the list', () => {
    // Two coordinates a few hundred metres apart: one blob at this zoom.
    const layout = layoutBubbles(
      [
        candidate({ key: 'second', priority: 3, lat: 52.101 }),
        candidate({ key: 'first', priority: 1, lat: 52.1 }),
      ],
      view
    );
    expect(layout.shown.map((b) => b.key)).toEqual(['first']);
    expect(layout.hidden.map((b) => b.key)).toEqual(['second']);
  });

  it('keeps the list order whatever order the candidates arrive in', () => {
    // The selected location, or the wettest, or the northernmost would all be
    // defensible — and all of them reshuffle the map as the weather moves.
    const layout = layoutBubbles(
      [
        candidate({ key: 'later', priority: 2, lat: 52.1005, mm: 99, selected: true }),
        candidate({ key: 'earlier', priority: 0, lat: 52.1, mm: 0.2 }),
      ],
      view
    );
    expect(layout.shown.map((b) => b.key)).toEqual(['earlier']);
  });

  it('draws both once the reader has zoomed in far enough to separate them', () => {
    const candidates = [
      candidate({ key: 'a', priority: 0, lat: 52.1 }),
      candidate({ key: 'b', priority: 1, lat: 52.13 }),
    ];
    expect(layoutBubbles(candidates, { ...view, zoom: 6 }).shown).toHaveLength(1);
    expect(layoutBubbles(candidates, { ...view, zoom: 11 }).shown).toHaveLength(2);
  });

  it('never lets a location with nothing to print take a slot', () => {
    const layout = layoutBubbles(
      [
        candidate({ key: 'empty', priority: 0, mm: null }),
        candidate({ key: 'has-a-figure', priority: 1 }),
      ],
      view
    );
    expect(layout.shown.map((b) => b.key)).toEqual(['has-a-figure']);
    expect(layout.hidden.map((b) => b.key)).toEqual(['empty']);
  });

  it('never lets a location off screen hide one the reader can see', () => {
    const layout = layoutBubbles(
      [
        candidate({ key: 'off-screen', priority: 0, lat: 40, lon: -20 }),
        candidate({ key: 'on-screen', priority: 1 }),
      ],
      view
    );
    expect(layout.shown.map((b) => b.key)).toEqual(['on-screen']);
  });

  it('places every bubble it shows within the viewport it was given', () => {
    const layout = layoutBubbles(
      [
        candidate({ key: 'a', priority: 0, lat: 52.6, lon: 4.6 }),
        candidate({ key: 'b', priority: 1, lat: 51.6, lon: 5.9 }),
      ],
      view
    );
    for (const bubble of layout.shown) {
      expect(bubble.x).toBeGreaterThan(0);
      expect(bubble.x).toBeLessThan(view.width);
      expect(bubble.y).toBeGreaterThan(0);
      expect(bubble.y).toBeLessThan(view.height);
      expect(bubble.size).toBe(bubbleDiameter(view.zoom));
    }
  });
});

describe('what a bubble prints', () => {
  it('drops the decimal once there is no room for it to matter', () => {
    expect(bubbleText(39.4)).toBe('39');
    expect(bubbleText(10)).toBe('10');
  });

  it('keeps the tenth below ten, where it is the whole difference', () => {
    expect(bubbleText(2.4)).toBe('2,4');
    expect(bubbleText(0.6)).toBe('0,6');
    expect(bubbleText(3)).toBe('3');
  });
});

describe('which source answers for a location', () => {
  const manifest = fixtureManifest;
  const window = windowOf(manifest, 24)!;
  const values = fixtureValues(24);
  const anchorMs = new Date(window.end).getTime();
  const here = { lat: 52.1, lon: 5.2 };

  /** A gauge that covers the whole 24 hour window. */
  const fullRows: PrecipHour[] = Array.from({ length: 24 }, (_, i) => ({
    endMs: anchorMs - i * 3600_000,
    precip: 0.5,
  }));

  it('reads the raster where there is no station', () => {
    const reading = readingFor({ location: here, manifest, window, values });
    expect(reading.origin).toBe('radar');
    expect(reading.mm).toBeGreaterThanOrEqual(0);
    expect(reading.loading).toBe(false);
  });

  it('prefers the gauge where one covers the window', () => {
    const reading = readingFor({
      location: { ...here, stationId: 's1', stationName: 'Elst' },
      manifest, window, values, stationRows: fullRows,
    });
    expect(reading.origin).toBe('station');
    expect(reading.mm).toBe(12);
    expect(reading.stationName).toBe('Elst');
  });

  it('falls back to the raster when the gauge is short of the window, and says so', () => {
    const reading = readingFor({
      location: { ...here, stationId: 's1', stationName: 'Elst' },
      manifest, window, values, stationRows: fullRows.slice(0, 20),
    });
    expect(reading.origin).toBe('radar');
    expect(reading.stationGap).toEqual({ hoursFound: 20, hoursExpected: 24 });
  });

  it('separates "outside the layer" from "still loading"', () => {
    const outside = readingFor({ location: { lat: 48, lon: 5 }, manifest, window, values });
    expect(outside.outsideCrop).toBe(true);
    expect(outside.loading).toBe(false);

    const pending = readingFor({ location: here, manifest, window, values: null });
    expect(pending.outsideCrop).toBe(false);
    expect(pending.loading).toBe(true);
    expect(pending.mm).toBeNull();
  });
});

describe('the accumulation curve', () => {
  const manifest = fixtureManifest;
  const windows = slidingWindows(manifest);
  const rasters = new Map(windows.map((w) => [w.hours, fixtureValues(w.hours)]));
  const here = { lat: 52.1, lon: 5.2 };

  it('runs shortest window first, matching the chart s axis', () => {
    const series = seriesFor({ location: here, manifest, windows, rasters });
    expect(series.map((p) => p.hours)).toEqual([1, 3, 6, 12, 24, 48]);
  });

  it('never falls, because the windows nest', () => {
    const series = seriesFor({ location: here, manifest, windows, rasters });
    for (let i = 1; i < series.length; i++) {
      expect(series[i]!.mm!).toBeGreaterThanOrEqual(series[i - 1]!.mm!);
    }
  });

  it('leaves a gap for a window that has not arrived, rather than drawing a zero', () => {
    // A zero would be a claim that it stopped raining; a gap is the truth, which is
    // that the answer is still coming.
    const partial = new Map([[24, fixtureValues(24)]]);
    const series = seriesFor({ location: here, manifest, windows, rasters: partial });
    expect(series.filter((p) => p.mm != null).map((p) => p.hours)).toEqual([24]);
  });

  it('is empty before the manifest arrives, so the chart has nothing to misdraw', () => {
    expect(seriesFor({ location: here, manifest: null, windows, rasters })).toEqual([]);
  });
});
