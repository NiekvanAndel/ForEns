/**
 * Radar provider tests.
 *
 * These are contract tests, not parity tests — index.html has no radar. They pin the
 * behaviour the Radar screen and the alert hero depend on, so that swapping in
 * ExactCast's own provider later has something concrete to satisfy.
 */
import { describe, it, expect } from 'vitest';
import { buildProfile, RainViewerProvider } from '../core/radar/rainviewer';
import { frameClock, intensityAt, radarAxis } from '../core/radar/labels';
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

  it('keeps the whole series, so the radar chart covers the observed frames too', () => {
    // Two past quarter-hours then now onwards, with the timestamps Open-Meteo
    // returns for `past_minutely_15` — local times, and a separate UTC offset.
    const NOW = Date.parse('2026-06-15T12:00:00Z');
    const p = buildProfile(
      {
        minutely_15: {
          time: [
            '2026-06-15T13:30', '2026-06-15T13:45',
            '2026-06-15T14:00', '2026-06-15T14:15', '2026-06-15T14:30',
          ],
          precipitation: [1.0, 0.5, 0, 0.25, 0],
        },
        utc_offset_seconds: 7200,
      },
      NOW
    );
    expect(p.series.map((b) => b.offsetMin)).toEqual([-30, -15, 0, 15, 30]);
    expect(p.series.map((b) => b.mmPerHour)).toEqual([4, 2, 0, 1, 0]);
  });

  it('measures the forward window from now, not from the start of the series', () => {
    // The past samples are the wettest ones. Counting them would put the total and
    // the "rain starts in" on the wrong side of the present.
    const NOW = Date.parse('2026-06-15T12:00:00Z');
    const p = buildProfile(
      {
        minutely_15: {
          time: [
            '2026-06-15T11:30', '2026-06-15T11:45',
            '2026-06-15T12:00', '2026-06-15T12:15', '2026-06-15T12:30',
          ],
          precipitation: [3.0, 3.0, 0, 0, 0.4],
        },
        utc_offset_seconds: 0,
      },
      NOW
    );
    expect(p.totalMm).toBe(0.4);
    expect(p.startsInMin).toBe(30);
    // The hero's bars still read forward from now.
    expect(p.bars.map((b) => b.mmPerHour)).toEqual([0, 1.6, 0, 0]);
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

  it('asks for retina tiles by default, so the map does not over-fetch depth', () => {
    // At 256 MapKit picks a zoom level around two deeper than the map is drawing,
    // which is how a country-wide view reached past what RainViewer serves.
    expect(provider.tileSize).toBe(512);
  });
  const frame = { timeMs: 1_700_000_000_000, forecast: false, id: 'https://tiles.rainviewer.com/v2/radar/1700000000' };

  it('builds a tile URL from the frame handle', () => {
    expect(provider.tileUrl({ frame, z: 8, x: 131, y: 84 })).toBe(
      'https://tiles.rainviewer.com/v2/radar/1700000000/512/8/131/84/2/1_1.png'
    );
  });

  it('honours per-call scheme and smoothing overrides', () => {
    expect(provider.tileUrl({ frame, z: 8, x: 131, y: 84, scheme: 4, smooth: false })).toBe(
      'https://tiles.rainviewer.com/v2/radar/1700000000/512/8/131/84/4/0_1.png'
    );
  });

  it('expresses the same URL as a z/x/y template for map components', () => {
    expect(provider.tileTemplate({ frame })).toBe(
      'https://tiles.rainviewer.com/v2/radar/1700000000/512/{z}/{x}/{y}/2/1_1.png'
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
      tileSize: 512,
      listFrames: async () => ({ past: [], forecast: [] }),
      tileUrl: ({ z, x, y }) => `https://example.invalid/${z}/${x}/${y}.png`,
      tileTemplate: () => 'https://example.invalid/{z}/{x}/{y}.png',
      nowcastProfile: async () => ({
        bars: [], series: [], totalMm: 0, confidence: 99, startsInMin: null, wet: false,
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
  const at = (min: number) => ({ id: `f${min}`, timeMs: NOW + min * 60_000, forecast: false });
  const NOW = 1_800_000_000_000;

  it('spans the frames, so the axis covers exactly what the map can show', () => {
    // The bug this prevents: the axis was widened to the end of the nowcast
    // profile, so with a past-only provider the chart ran two hours past the last
    // radar picture and the thumb hit the right edge halfway through its travel.
    const axis = radarAxis([at(-120), at(-60), at(0)], NOW)!;
    expect(axis.from).toBe(-120);
    expect(axis.to).toBe(0);
  });

  it('places each frame by time, not by index', () => {
    // Uneven spacing: by index the middle frame would sit at 0.5.
    const axis = radarAxis([at(-120), at(-90), at(0)], NOW)!;
    expect(axis.positions).toEqual([0, 0.25, 1]);
  });

  it('reaches into the future when the provider has forecast frames', () => {
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
