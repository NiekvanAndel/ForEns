/**
 * Radar provider tests.
 *
 * These are contract tests, not parity tests — index.html has no radar. They pin the
 * behaviour the Radar screen and the nowcast panel depend on: the geometry that puts
 * the DGMR imagery in the right place, the decoding that turns its bytes into
 * millimetres, and the profile the panel draws from them.
 *
 * The network is deliberately untouched. Everything below is the pure half of the
 * adapter, which is why it is worth having as a test at all.
 */
import { describe, it, expect } from 'vitest';
import {
  ExactCastProvider, boundsFromMercator, buildProfile, decodeRainRate, gridIndexFor,
  isWithinGrid,
} from '../core/radar/exactcast';
import { frameClock, intensityAt, radarAxis } from '../core/radar/labels';
import {
  activeProvider, listProviders, registerProvider, setActiveProvider,
  type RadarProvider,
} from '../core/radar';

/** The bounds every run publishes, from the DGMR readme. */
const BOUNDS_3857 = [0.0, 6257229.905, 1209010.249, 7553162.46] as const;

describe('boundsFromMercator', () => {
  it('places the overlay on the rectangle the readme documents', () => {
    // The readme states the same rectangle in degrees: lon 0 → 10.856, lat 48.90 →
    // 55.97. Deriving it from the manifest rather than hard-coding those corners is
    // what keeps the image in the right place if the product grid ever moves.
    const b = boundsFromMercator(BOUNDS_3857);
    expect(b.west).toBeCloseTo(0, 6);
    expect(b.east).toBeCloseTo(10.856, 2);
    expect(b.south).toBeCloseTo(48.895, 2);
    expect(b.north).toBeCloseTo(55.974, 2);
  });

  it('keeps north above south and east above west, which is what the map assumes', () => {
    const b = boundsFromMercator(BOUNDS_3857);
    expect(b.north).toBeGreaterThan(b.south);
    expect(b.east).toBeGreaterThan(b.west);
  });
});

describe('decodeRainRate', () => {
  it('reads zero as no rain rather than as the bottom of the scale', () => {
    expect(decodeRainRate(0)).toBe(0);
  });

  it('spans 0.1 to 128 mm/h over the 255 non-zero levels', () => {
    expect(decodeRainRate(1)).toBeCloseTo(0.1, 6);
    expect(decodeRainRate(255)).toBeCloseTo(128, 4);
  });

  it('is geometric, so each step is a fixed ratio rather than a fixed amount', () => {
    const ratio = decodeRainRate(3) / decodeRainRate(2);
    expect(decodeRainRate(2) / decodeRainRate(1)).toBeCloseTo(ratio, 10);
  });
});

describe('isWithinGrid', () => {
  it('covers the Netherlands', () => {
    expect(isWithinGrid(52.37, 4.9)).toBe(true);   // Amsterdam
    expect(isWithinGrid(50.85, 5.69)).toBe(true);  // Maastricht
  });

  it('covers Belgium and western Germany, which the product also reaches', () => {
    expect(isWithinGrid(50.85, 4.35)).toBe(true);  // Brussels
    expect(isWithinGrid(51.23, 6.78)).toBe(true);  // Düsseldorf
  });

  it('rejects a location the run has nothing to say about', () => {
    // The screens ask before they draw, so this is what produces a sentence
    // instead of an empty chart under a map that does not reach the reader.
    expect(isWithinGrid(40.42, -3.7)).toBe(false);  // Madrid
    expect(isWithinGrid(59.33, 18.07)).toBe(false); // Stockholm
  });
});

describe('gridIndexFor', () => {
  it('stays inside the 700×765 raster', () => {
    const index = gridIndexFor(52.37, 4.9);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(700 * 765);
  });

  it('puts north above south and east right of west in the row-major grid', () => {
    const cols = 700;
    const north = gridIndexFor(53.5, 5.5);
    const south = gridIndexFor(51.0, 5.5);
    // Row 0 is the north edge, so a northern point sits in an earlier row.
    expect(Math.floor(north / cols)).toBeLessThan(Math.floor(south / cols));

    const west = gridIndexFor(52.0, 4.0);
    const east = gridIndexFor(52.0, 6.5);
    expect(west % cols).toBeLessThan(east % cols);
  });

  it('clamps a point outside the product to an edge cell rather than off the array', () => {
    const index = gridIndexFor(40.42, -3.7);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(700 * 765);
  });
});

describe('buildProfile', () => {
  /** A run as the adapter hands it over: offsets already measured from now. */
  const run = (rates: number[], from = -15) =>
    rates.map((mmPerHour, i) => ({ offsetMin: from + i * 5, mmPerHour }));

  it('samples bars at now, +30, +60 and +90 — the end of the run', () => {
    const p = buildProfile(run(new Array(22).fill(0)));
    expect(p.bars.map((b) => b.offsetMin)).toEqual([0, 30, 60, 90]);
  });

  it('interpolates a bar between the five-minute frames around it', () => {
    // Frames at +30 and +35 read 2 and 4; a bar at +30 takes the frame exactly.
    const rates = new Array(22).fill(0);
    rates[9] = 2;   // -15 + 9*5 = +30
    rates[10] = 4;  // +35
    const p = buildProfile(run(rates));
    expect(p.bars[1]!.mmPerHour).toBe(2);
  });

  it('totals only what is still to fall, not the observed frames behind us', () => {
    // Two wet observed frames, then one wet forecast frame at +5.
    const rates = new Array(22).fill(0);
    rates[0] = 12; rates[1] = 12;  // -15, -10: already fallen
    rates[4] = 12;                 // +5: still to come
    const p = buildProfile(run(rates));
    // One frame stands for five minutes: 12 mm/h × 5/60 = 1 mm.
    expect(p.totalMm).toBe(1);
    expect(p.wet).toBe(true);
  });

  it('reports when rain starts, measured forward from now', () => {
    const rates = new Array(22).fill(0);
    rates[0] = 5;   // -15, observed: not an answer to "when does it start"
    rates[7] = 5;   // +20
    const p = buildProfile(run(rates));
    expect(p.startsInMin).toBe(20);
  });

  it('reports a dry run', () => {
    const p = buildProfile(run(new Array(22).fill(0)));
    expect(p.wet).toBe(false);
    expect(p.startsInMin).toBeNull();
    expect(p.totalMm).toBe(0);
    // Dry is a confident call, and every bar still renders at the floor height.
    expect(p.confidence).toBe(90);
    expect(p.bars.every((b) => b.height === 4)).toBe(true);
  });

  it('grows less confident the further out the rain is', () => {
    const soon = new Array(22).fill(0); soon[4] = 5;    // +5
    const later = new Array(22).fill(0); later[21] = 5; // +90
    const a = buildProfile(run(soon));
    const b = buildProfile(run(later));
    expect(a.confidence).toBeGreaterThan(b.confidence);
    expect(b.confidence).toBeGreaterThanOrEqual(45);
  });

  it('treats drizzle below the wet threshold as dry', () => {
    const rates = new Array(22).fill(0);
    rates[6] = 0.1;
    expect(buildProfile(run(rates)).startsInMin).toBeNull();
  });

  it('keeps every frame in the series, so the chart covers the observed half too', () => {
    const p = buildProfile(run(new Array(22).fill(0)));
    expect(p.series).toHaveLength(22);
    expect(p.series[0]!.offsetMin).toBe(-15);
    expect(p.series[21]!.offsetMin).toBe(90);
  });

  it('clamps bar heights to a readable band', () => {
    const p = buildProfile(run(new Array(22).fill(50)));
    expect(p.bars.every((b) => b.height >= 4 && b.height <= 100)).toBe(true);
    expect(p.bars[0]!.height).toBe(100);
  });

  it('survives an empty run rather than throwing under the panel', () => {
    const p = buildProfile([]);
    expect(p.bars).toHaveLength(4);
    expect(p.wet).toBe(false);
  });
});

describe('ExactCastProvider', () => {
  const provider = new ExactCastProvider();

  it('is an overlay provider, because the run publishes images and not tiles', () => {
    expect(provider.kind).toBe('overlay');
  });

  it('answers coverage from the product grid', () => {
    expect(provider.coversPoint(52.09, 5.12)).toBe(true);
    expect(provider.coversPoint(40.42, -3.7)).toBe(false);
  });

  it('refuses a profile outside the grid rather than inventing an edge value', async () => {
    // gridIndexFor would happily clamp to the nearest cell; reporting a Dutch
    // shower to a reader in Madrid is worse than reporting nothing.
    await expect(provider.nowcastProfile(40.42, -3.7)).rejects.toThrow(/outside/);
  });

  it('has no overlay to give before it has read a manifest', () => {
    // The bounds come from the same manifest as the frames, so a frame the caller
    // actually got from listFrames always has one.
    expect(provider.frameOverlay({ id: 'x_0', timeMs: 0, forecast: false })).toBeNull();
  });

  it('rejects a run whose last frame is already behind us', async () => {
    // The server missed its schedule. Drawing the loop anyway would present a
    // stale hour and a half as the coming one.
    const expired = {
      timestamp: new Date(Date.now() - 4 * 60 * 60_000).toISOString(),
      prefix: '2020-01-01T00-00',
      offsets: [-15, 0, 90],
      bounds_3857: BOUNDS_3857,
    };
    const stub = new ExactCastProvider();
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(expired), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;
    try {
      await expect(stub.listFrames()).rejects.toThrow(/expired/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('accepts a run that still has forecast frames ahead of it', async () => {
    const live = {
      // Half an hour old: the +90 frames still lie ahead.
      timestamp: new Date(Date.now() - 30 * 60_000).toISOString(),
      prefix: '2026-08-19T10-30',
      offsets: [-15, 0, 90],
      bounds_3857: BOUNDS_3857,
    };
    const stub = new ExactCastProvider();
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(live), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;
    try {
      const frames = await stub.listFrames();
      // Offset 0 is the latest observation, not a forecast.
      expect(frames.past.map((f) => f.id)).toEqual([
        '2026-08-19T10-30_-15', '2026-08-19T10-30_0',
      ]);
      expect(frames.forecast.map((f) => f.id)).toEqual(['2026-08-19T10-30_90']);
      // The bounds arrive with the frames, so the overlay can be placed at once.
      expect(stub.frameOverlay(frames.forecast[0]!)?.bounds.north).toBeCloseTo(55.974, 2);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('builds frame image URLs from the frame handle', () => {
    const urls = provider.frameImageUrls([
      { id: '2026-08-19T10-30_-15', timeMs: 0, forecast: false },
      { id: '2026-08-19T10-30_90', timeMs: 0, forecast: true },
    ]);
    expect(urls).toEqual([
      'https://nowcast.agroexact.com/2026-08-19T10-30_-15.png',
      'https://nowcast.agroexact.com/2026-08-19T10-30_90.png',
    ]);
  });
});

describe('provider registry', () => {
  it('defaults to ExactCast', () => {
    expect(activeProvider().id).toBe('exactcast');
  });

  it('swaps to a registered provider without touching call sites', () => {
    const stub: RadarProvider = {
      kind: 'tiles',
      id: 'stub',
      label: 'Stub radar',
      maxZoom: 14,
      tileSize: 512,
      listFrames: async () => ({ past: [], forecast: [] }),
      coversPoint: () => true,
      tileUrl: ({ z, x, y }) => `https://example.invalid/${z}/${x}/${y}.png`,
      tileTemplate: () => 'https://example.invalid/{z}/{x}/{y}.png',
      nowcastProfile: async () => ({
        bars: [], series: [], totalMm: 0, confidence: 99, startsInMin: null, wet: false,
      }),
    };
    registerProvider(stub);
    setActiveProvider('stub');
    expect(activeProvider().label).toBe('Stub radar');
    expect(listProviders().map((p) => p.id).sort()).toEqual(['exactcast', 'stub']);
    setActiveProvider('exactcast');
  });

  it('rejects an unregistered id rather than failing silently later', () => {
    expect(() => setActiveProvider('nope')).toThrow(/no provider registered/);
    expect(activeProvider().id).toBe('exactcast');
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

describe('frameClock', () => {
  it('names the hour rather than an offset a reader has to compute', () => {
    const at = new Date(2026, 5, 15, 9, 5).getTime();
    expect(frameClock({ id: 'x', timeMs: at, forecast: false })).toBe('09:05');
  });

  it('pads both halves, so a column of times lines up', () => {
    const at = new Date(2026, 5, 15, 0, 0).getTime();
    expect(frameClock({ id: 'x', timeMs: at, forecast: false })).toBe('00:00');
  });

  it('has something to show for a missing frame', () => {
    expect(frameClock(undefined)).toBe('—');
  });
});

describe('radarAxis', () => {
  const NOW = 1_800_000_000_000;
  const at = (min: number) => ({ id: `f${min}`, timeMs: NOW + min * 60_000, forecast: min > 0 });

  it('spans the frames, so the axis covers exactly what the map can show', () => {
    const axis = radarAxis([at(-15), at(0), at(90)], NOW)!;
    expect(axis.from).toBe(-15);
    expect(axis.to).toBe(90);
  });

  it('places each frame by time, not by index', () => {
    const axis = radarAxis([at(-120), at(-90), at(0)], NOW)!;
    expect(axis.positions).toEqual([0, 0.25, 1]);
  });

  it('reaches into the future across the run', () => {
    const axis = radarAxis([at(-60), at(0), at(30)], NOW)!;
    expect(axis.to).toBe(30);
    expect(axis.positions).toEqual([0, 2 / 3, 1]);
  });

  it('has nothing to say without frames', () => {
    expect(radarAxis([], NOW)).toBeNull();
  });

  it('survives a single frame without dividing by zero', () => {
    const axis = radarAxis([at(0)], NOW)!;
    expect(axis.positions).toEqual([0]);
  });
});
