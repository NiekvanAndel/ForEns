/**
 * Radar provider tests.
 *
 * These are contract tests, not parity tests — index.html has no radar. They pin the
 * behaviour the Radar screen and the alert hero depend on, so that swapping in
 * ExactCast's own provider later has something concrete to satisfy.
 */
import { describe, it, expect } from 'vitest';
import { buildProfile, RainViewerProvider } from '../core/radar/rainviewer';
import { intensityAt } from '../core/radar/labels';
import {
  activeProvider, listProviders, registerProvider, setActiveProvider,
  type RadarProvider,
} from '../core/radar';

describe('buildProfile', () => {
  it('reads bars at now, +30, +60 and +120 minutes', () => {
    // Quarter-hourly mm: index 0=now, 2=+30, 4=+60, 8=+120.
    const values = [0, 0, 0.5, 0, 1.0, 0, 0, 0, 2.0];
    const p = buildProfile({ minutely_15: { precipitation: values } });
    expect(p.bars.map((b) => b.offsetMin)).toEqual([0, 30, 60, 120]);
    // mm per quarter-hour becomes mm/h.
    expect(p.bars.map((b) => b.mmPerHour)).toEqual([0, 2, 4, 8]);
  });

  it('sums the whole window, not just the sampled bars', () => {
    const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0, 0, 0, 0];
    const p = buildProfile({ minutely_15: { precipitation: values } });
    expect(p.totalMm).toBe(1.5);
    expect(p.wet).toBe(true);
  });

  it('reports a dry window', () => {
    const p = buildProfile({ minutely_15: { precipitation: new Array(9).fill(0) } });
    expect(p.wet).toBe(false);
    expect(p.startsInMin).toBeNull();
    expect(p.totalMm).toBe(0);
    // Dry is a confident call, and every bar still renders at the floor height.
    expect(p.confidence).toBe(90);
    expect(p.bars.every((b) => b.height === 4)).toBe(true);
  });

  it('reports when rain starts, and grows less confident further out', () => {
    const soon = buildProfile({
      minutely_15: { precipitation: [0, 1, 0, 0, 0, 0, 0, 0, 0] },
    });
    const later = buildProfile({
      minutely_15: { precipitation: [0, 0, 0, 0, 0, 0, 0, 1, 0] },
    });
    expect(soon.startsInMin).toBe(15);
    expect(later.startsInMin).toBe(105);
    expect(soon.confidence).toBeGreaterThan(later.confidence);
    expect(later.confidence).toBeGreaterThanOrEqual(45);
  });

  it('treats a trace below 0.05 mm as dry', () => {
    const p = buildProfile({ minutely_15: { precipitation: [0.01, 0.02, 0, 0, 0, 0, 0, 0, 0] } });
    expect(p.startsInMin).toBeNull();
  });

  it('clamps bar heights and survives nulls and a short series', () => {
    const p = buildProfile({ minutely_15: { precipitation: [50, null, 3] } });
    expect(p.bars[0]!.height).toBe(100);
    // Missing samples read as zero rather than throwing.
    expect(p.bars[3]!.mmPerHour).toBe(0);
    expect(p.bars.every((b) => b.height >= 4 && b.height <= 100)).toBe(true);
  });

  it('survives a response with no minutely block at all', () => {
    const p = buildProfile({});
    expect(p.wet).toBe(false);
    expect(p.bars).toHaveLength(4);
  });
});

describe('RainViewerProvider.tileUrl', () => {
  const provider = new RainViewerProvider();
  const frame = { timeMs: 1_700_000_000_000, forecast: false, id: 'https://tiles.rainviewer.com/v2/radar/1700000000' };

  it('builds a tile URL from the frame handle', () => {
    expect(provider.tileUrl({ frame, z: 8, x: 131, y: 84 })).toBe(
      'https://tiles.rainviewer.com/v2/radar/1700000000/256/8/131/84/2/1_1.png'
    );
  });

  it('honours per-call scheme and smoothing overrides', () => {
    expect(provider.tileUrl({ frame, z: 8, x: 131, y: 84, scheme: 4, smooth: false })).toBe(
      'https://tiles.rainviewer.com/v2/radar/1700000000/256/8/131/84/4/0_1.png'
    );
  });

  it('expresses the same URL as a z/x/y template for map components', () => {
    expect(provider.tileTemplate({ frame })).toBe(
      'https://tiles.rainviewer.com/v2/radar/1700000000/256/{z}/{x}/{y}/2/1_1.png'
    );
    // The template must agree with the concrete URL it stands in for.
    const filled = provider.tileTemplate({ frame })
      .replace('{z}', '8').replace('{x}', '131').replace('{y}', '84');
    expect(filled).toBe(provider.tileUrl({ frame, z: 8, x: 131, y: 84 }));
  });

  it('honours constructor options', () => {
    const p512 = new RainViewerProvider({ tileSize: 512, scheme: 6, snow: false });
    expect(p512.tileUrl({ frame, z: 3, x: 1, y: 2 })).toBe(
      'https://tiles.rainviewer.com/v2/radar/1700000000/512/3/1/2/6/1_0.png'
    );
  });
});

describe('provider registry', () => {
  it('defaults to RainViewer', () => {
    expect(activeProvider().id).toBe('rainviewer');
  });

  it('swaps to a registered provider without touching call sites', () => {
    const stub: RadarProvider = {
      id: 'exactcast',
      label: 'ExactCast AI nowcast',
      maxZoom: 14,
      listFrames: async () => ({ past: [], forecast: [] }),
      tileUrl: ({ z, x, y }) => `https://example.invalid/${z}/${x}/${y}.png`,
      tileTemplate: () => 'https://example.invalid/{z}/{x}/{y}.png',
      nowcastProfile: async () => ({
        bars: [], totalMm: 0, confidence: 99, startsInMin: null, wet: false,
      }),
    };
    registerProvider(stub);
    setActiveProvider('exactcast');
    expect(activeProvider().label).toBe('ExactCast AI nowcast');
    expect(listProviders().map((p) => p.id).sort()).toEqual(['exactcast', 'rainviewer']);
    setActiveProvider('rainviewer');
  });

  it('rejects an unregistered id rather than failing silently later', () => {
    expect(() => setActiveProvider('nope')).toThrow(/no provider registered/);
    expect(activeProvider().id).toBe('rainviewer');
  });
});

describe('intensityAt', () => {
  const bars = [
    { offsetMin: 0, mmPerHour: 0 },
    { offsetMin: 30, mmPerHour: 2 },
    { offsetMin: 60, mmPerHour: 6 },
  ];

  it('reads a sample exactly at its own offset', () => {
    expect(intensityAt(bars, 30)).toBe(2);
  });

  it('interpolates between two samples, since the scrubber lands between them', () => {
    expect(intensityAt(bars, 15)).toBeCloseTo(1, 10);
    expect(intensityAt(bars, 45)).toBeCloseTo(4, 10);
  });

  it('holds the end values rather than extrapolating off the profile', () => {
    expect(intensityAt(bars, -20)).toBe(0);
    expect(intensityAt(bars, 500)).toBe(6);
  });

  it('is zero with no profile at all', () => {
    expect(intensityAt([], 10)).toBe(0);
  });
});
