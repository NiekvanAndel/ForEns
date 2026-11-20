import { describe, expect, it } from 'vitest';
import { inflateSync, crc32, gzipSync } from 'node:zlib';
import {
  SUM_LEGEND, SUM_RASTER_COLS, SUM_RASTER_ROWS, WindowAccumulator, candidateRuns,
  encodeTotalsPng, frameShare, frameUrl, mercatorLookup, nowcastSumSource, planFrames,
  runPrefix, toMapRaster,
} from '../core/radar/nowcastSum';
import { GRID_COLS, GRID_ROWS, gridCellAt } from '../core/radar/exactcast';
import { sampleMm } from '../core/radar/cumulative';
import { fixtureManifest } from '../core/radar/fixture';

const BOUNDS_3857 = [0.0, 6257229.905, 1209010.249, 7553162.46] as [number, number, number, number];
const ANCHOR = Date.parse('2026-11-20T12:00:00Z');
const MIN = 60_000;
const CELLS = GRID_COLS * GRID_ROWS;

/** The byte the frames use for a rate, inverting `decodeRainRate`. */
const byteFor = (mmh: number) => Math.round(1 + (254 * Math.log(mmh / 0.1)) / Math.log(1280));

/** Runs at a fixed cadence, newest first, the last `hours` hours before the anchor. */
const runsEvery = (minutes: number, hours = 24) => {
  const out: number[] = [];
  for (let t = ANCHOR - minutes * MIN; t > ANCHOR - hours * 60 * MIN; t -= minutes * MIN) out.push(t);
  return out;
};

describe('file names', () => {
  it('writes a prefix as the run time in UTC', () => {
    expect(runPrefix(Date.parse('2026-08-19T10:30:00Z'))).toBe('2026-08-19T10-30');
    expect(runPrefix(Date.parse('2026-01-02T03:05:00Z'))).toBe('2026-01-02T03-05');
  });

  it('reads frames from the bins folder', () => {
    expect(frameUrl(Date.parse('2026-08-19T10:30:00Z'), -15)).toBe(
      'https://nowcast.agroexact.com/bins/2026-08-19T10-30_-15.bin'
    );
  });

  it('probes every five-minute mark of the day behind the newest run', () => {
    const c = candidateRuns(ANCHOR, 24);
    expect(c).toHaveLength(287);
    expect(c[0]).toBe(ANCHOR - 5 * MIN);
    // The oldest run that can still carry a frame inside the window.
    expect(c[c.length - 1]).toBe(ANCHOR - 24 * 60 * MIN + 5 * MIN);
  });
});

describe('planFrames', () => {
  it('covers every slot when the nowcast runs every 20 minutes', () => {
    const plan = planFrames(ANCHOR, 24, runsEvery(20));
    expect(plan).toHaveLength(288);
    expect(plan.every((f) => f.url)).toBe(true);
  });

  it('misses a third of the slots at a half-hourly cadence', () => {
    // The gap the AgroExact answer describes: 8 of every 12 frames.
    const plan = planFrames(ANCHOR, 24, runsEvery(30));
    expect(plan.filter((f) => f.url)).toHaveLength(192);
  });

  it('takes a slot from the newest run that carries it', () => {
    // Runs five minutes apart both carry 11:50; the 12:00 run publishes it as -10.
    const plan = planFrames(ANCHOR, 1, [ANCHOR - 5 * MIN]);
    const at1150 = plan.find((f) => f.slotMs === ANCHOR - 10 * MIN)!;
    expect(at1150.url).toBe('https://nowcast.agroexact.com/bins/2026-11-20T12-00_-10.bin');
    const at1140 = plan.find((f) => f.slotMs === ANCHOR - 20 * MIN)!;
    expect(at1140.url).toBe('https://nowcast.agroexact.com/bins/2026-11-20T11-55_-15.bin');
    // Nothing covers 11:35 and earlier.
    expect(plan.find((f) => f.slotMs === ANCHOR - 25 * MIN)!.url).toBeNull();
  });
});

describe('WindowAccumulator', () => {
  it('turns a day of 1 mm/h into 24 mm, and nests the shorter windows in it', () => {
    const acc = new WindowAccumulator(ANCHOR, [1, 3, 6, 12, 24]);
    const frame = new Uint8Array(CELLS).fill(byteFor(1));
    for (let i = 0; i < 288; i++) acc.add(ANCHOR - i * 5 * MIN, frame);
    const totals = [0, 1, 2, 3, 4].map((k) => acc.window(k));
    expect(totals.map((t) => t.frames)).toEqual([12, 36, 72, 144, 288]);
    // One step of the byte scale is 2.9%, so "1 mm/h" is only that close to 1.
    expect(totals[0]!.mm[0]).toBeCloseTo(1, 1);
    expect(totals[4]!.mm[0]).toBeGreaterThan(23.5);
    expect(totals[4]!.mm[0]).toBeLessThan(24.5);
  });

  it('ignores a frame outside the longest window', () => {
    const acc = new WindowAccumulator(ANCHOR, [1]);
    acc.add(ANCHOR - 60 * MIN, new Uint8Array(CELLS).fill(200));
    acc.add(ANCHOR + 5 * MIN, new Uint8Array(CELLS).fill(200));
    expect(acc.window(0).frames).toBe(0);
  });
});

describe('onto the map', () => {
  it('maps each image pixel to the radar cell under it', async () => {
    const lookup = await mercatorLookup(BOUNDS_3857);
    expect(lookup).toHaveLength(SUM_RASTER_COLS * SUM_RASTER_ROWS);
    // Utrecht, through the image's own pixel geometry.
    const lat = 52.09;
    const lon = 5.12;
    const x = (lon / 180) * Math.PI * 6378137;
    const y = 6378137 * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const col = Math.floor(((x - BOUNDS_3857[0]) / (BOUNDS_3857[2] - BOUNDS_3857[0])) * SUM_RASTER_COLS);
    const row = Math.floor(((BOUNDS_3857[3] - y) / (BOUNDS_3857[3] - BOUNDS_3857[1])) * SUM_RASTER_ROWS);
    const cell = lookup[row * SUM_RASTER_COLS + col]!;
    const expected = gridCellAt(lat, lon);
    // Same cell or a direct neighbour: the image pixel is a kilometre across too.
    expect(Math.abs((cell % GRID_COLS) - (expected % GRID_COLS))).toBeLessThanOrEqual(1);
    expect(Math.abs(Math.floor(cell / GRID_COLS) - Math.floor(expected / GRID_COLS))).toBeLessThanOrEqual(1);
  });

  it('stores tenths of a millimetre and leaves pixels off the radar at zero', () => {
    const mm = new Float32Array(CELLS).fill(12.34);
    const { values, maxMm } = toMapRaster(mm, Int32Array.from([0, -1, 5]));
    expect(Array.from(values)).toEqual([123, 0, 123]);
    expect(maxMm).toBeCloseTo(12.3, 1);
  });
});

describe('encodeTotalsPng', () => {
  /** Chunks of a PNG, with their CRCs checked. */
  const chunksOf = (png: Uint8Array) => {
    const buf = Buffer.from(png);
    expect(Array.from(buf.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const out = new Map<string, Buffer>();
    for (let p = 8; p < buf.length; ) {
      const len = buf.readUInt32BE(p);
      const type = buf.toString('latin1', p + 4, p + 8);
      expect(buf.readUInt32BE(p + 8 + len)).toBe(crc32(buf.subarray(p + 4, p + 8 + len)));
      out.set(type, buf.subarray(p + 8, p + 8 + len));
      p += 12 + len;
    }
    return out;
  };

  it('writes a valid palette PNG with dry ground transparent', () => {
    // 0.2 mm (dry), 0.5 (first class), 4 mm (second class: 3..5), 95 mm (last).
    const values = Uint16Array.from([2, 5, 40, 950]);
    const chunks = chunksOf(encodeTotalsPng(values, 2, 2, SUM_LEGEND));
    const ihdr = chunks.get('IHDR')!;
    expect([ihdr.readUInt32BE(0), ihdr.readUInt32BE(4), ihdr[8], ihdr[9]]).toEqual([2, 2, 8, 3]);
    const raw = inflateSync(chunks.get('IDAT')!);
    // Two scanlines, each a filter byte and two palette indices.
    expect(Array.from(raw)).toEqual([0, 0, 1, 0, 2, 13]);
    expect(chunks.get('tRNS')![0]).toBe(0);
    expect(Array.from(chunks.get('PLTE')!.subarray(3, 6))).toEqual([0x03, 0x99, 0xfe]);
  });

  it('splits a full-size image over stored blocks that still inflate', () => {
    const values = new Uint16Array(SUM_RASTER_COLS * SUM_RASTER_ROWS).fill(100);
    const chunks = chunksOf(encodeTotalsPng(values, SUM_RASTER_COLS, SUM_RASTER_ROWS, SUM_LEGEND));
    expect(inflateSync(chunks.get('IDAT')!)).toHaveLength((SUM_RASTER_COLS + 1) * SUM_RASTER_ROWS);
  });

  it('carries the same ramp as the server contract', () => {
    expect(SUM_LEGEND).toEqual(fixtureManifest.legend);
  });
});

describe('nowcastSumSource', () => {
  /** A bucket holding runs at the given cadence, every frame raining `mmh`. */
  /** How the bucket misbehaves, one switch per cause of an empty map. */
  interface Quirks {
    /** Runs older than this many hours are still in the root, as before the move. */
    movedHoursAgo?: number;
    /** What a HEAD is answered with when the file exists. */
    headStatus?: number;
    /** Serve the frames as gzip bytes without `Content-Encoding`. */
    rawGzip?: boolean;
    /** Answer this many requests in a row with 429 before serving. */
    busyFirst?: number;
  }

  const bucket = (
    cadenceMin: number, mmh: number, prefix = '2026-11-20T12-00', keptHours = 49, quirks: Quirks = {}
  ) => {
    const runTimes = [ANCHOR, ...runsEvery(cadenceMin, keptHours)];
    const moved = quirks.movedHoursAgo ?? Infinity;
    const inBins = new Set(runTimes.filter((t) => ANCHOR - t < moved * 60 * MIN).map(runPrefix));
    const inRoot = new Set(runTimes.filter((t) => ANCHOR - t >= moved * 60 * MIN).map(runPrefix));
    const frame = new Uint8Array(CELLS).fill(byteFor(mmh));
    const body = quirks.rawGzip ? gzipSync(frame) : frame;
    let busy = quirks.busyFirst ?? 0;
    const requested: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requested.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.endsWith('/latest.json')) {
        return Response.json({
          timestamp: new Date(ANCHOR).toISOString(),
          prefix,
          offsets: [-15, -10, -5, 0, 5, 90],
          bounds_3857: BOUNDS_3857,
        });
      }
      if (busy > 0) {
        busy--;
        return new Response(null, { status: 429 });
      }
      const m = /\.com\/(bins\/)?([^/]+)_(-?\d+)\.bin$/.exec(url);
      const there = m && (m[1] ? inBins : inRoot).has(m[2]!);
      if (!there) return new Response(null, { status: 404 });
      if (init?.method === 'HEAD') return new Response(null, { status: quirks.headStatus ?? 200 });
      return new Response(body.slice());
    }) as typeof fetch;
    const written = new Map<string, Uint8Array>();
    const source = nowcastSumSource({
      fetchImpl,
      now: () => ANCHOR + 3 * MIN,
      writePng: (name, bytes) => {
        written.set(name, bytes);
        return `file:///cache/${name}`;
      },
    });
    return { source, requested, written };
  };

  it('builds six nested windows from two complete days of frames', async () => {
    const { source, written } = bucket(20, 2);
    const manifest = await source.manifest();
    expect(manifest.source).toBe('nowcast');
    expect(manifest.anchor).toBe('2026-11-20T12:00:00.000Z');
    expect(manifest.windows.map((w) => w.hours)).toEqual([1, 3, 6, 12, 24, 48]);
    expect(manifest.windows.every((w) => w.complete)).toBe(true);
    expect(manifest.windows.map(frameShare)).toEqual([1, 1, 1, 1, 1, 1]);

    const day = manifest.windows[4]!;
    expect(day.png_url).toBe('file:///cache/cumulative-2026-11-20T12-00-24h.png');
    expect(source.overlayUrl(day)).toBe(day.png_url);
    expect(written.size).toBe(6);
    const twoDays = manifest.windows[5]!;
    const mm48 = sampleMm(manifest, await source.values(twoDays), 52.09, 5.12)!;
    expect(mm48).toBeGreaterThan(94);
    expect(mm48).toBeLessThan(98);

    // 2 mm/h for a day, read back at Utrecht through the existing sampler.
    const mm = sampleMm(manifest, await source.values(day), 52.09, 5.12)!;
    expect(mm).toBeGreaterThan(47);
    expect(mm).toBeLessThan(49);
    expect(sampleMm(manifest, await source.values(manifest.windows[0]!), 52.09, 5.12)).toBeCloseTo(2, 0);
  }, 30_000);

  it('says how short the total is at a half-hourly cadence', async () => {
    const { source } = bucket(30, 2);
    const manifest = await source.manifest();
    const day = manifest.windows[4]!;
    expect(day.complete).toBe(false);
    expect(day.hours_found).toBe(16);
    expect(Math.floor(frameShare(day) * 100)).toBe(66);
    expect(manifest.windows[5]!.hours_found).toBe(32);
  }, 30_000);

  it('counts hours the bucket no longer keeps as missing', async () => {
    // Retention of about 40 hours: the 48 hour window is short, the day is whole.
    const { source } = bucket(20, 2, '2026-11-20T12-00', 40);
    const manifest = await source.manifest();
    expect(manifest.windows[4]!.complete).toBe(true);
    const twoDays = manifest.windows[5]!;
    expect(twoDays.complete).toBe(false);
    expect(twoDays.hours_found).toBeGreaterThan(39);
    expect(twoDays.hours_found).toBeLessThan(41);
  }, 30_000);

  it('finds runs from before the move in the bucket root', async () => {
    // The bins/ layout went live ten hours ago; everything older is in the root.
    const { source } = bucket(20, 2, '2026-11-20T12-00', 49, { movedHoursAgo: 10 });
    const manifest = await source.manifest();
    expect(manifest.windows.every((w) => w.complete)).toBe(true);
    expect(manifest.diagnostics).toMatch(/runs 144 \(bins 30, root 114\)/);
  }, 30_000);

  it('does not let a server that refuses HEAD hide every older run', async () => {
    // A 403 on HEAD for a file that exists: the probe falls back to a range request.
    const { source, requested } = bucket(20, 2, '2026-11-20T12-00', 49, { headStatus: 403 });
    const manifest = await source.manifest();
    expect(manifest.windows[5]!.complete).toBe(true);
    expect(manifest.diagnostics).toContain('check RANGE');
    expect(requested.filter((r) => r.startsWith('HEAD'))).toHaveLength(2);
  }, 30_000);

  it('unpacks frames that arrive gzipped without a Content-Encoding header', async () => {
    const { source } = bucket(20, 2, '2026-11-20T12-00', 49, { rawGzip: true });
    const manifest = await source.manifest();
    expect(manifest.windows[5]!.complete).toBe(true);
    expect(manifest.diagnostics).toContain('gzip 576');
    const mm = sampleMm(manifest, await source.values(manifest.windows[4]!), 52.09, 5.12)!;
    expect(mm).toBeGreaterThan(47);
  }, 30_000);

  it('waits out a busy server instead of counting the run as missing', async () => {
    const { source } = bucket(20, 2, '2026-11-20T12-00', 49, { busyFirst: 2 });
    const manifest = await source.manifest();
    expect(manifest.windows[5]!.complete).toBe(true);
  }, 30_000);

  it('reports what it read, for the screen', async () => {
    const { source } = bucket(30, 2);
    const manifest = await source.manifest();
    expect(manifest.diagnostics).toMatch(/^runs 96 \(bins 96, root 0\) · beelden 384\/576 · afgewezen http 0, formaat 0 · gzip 0 · check HEAD · piek 2\.\d mm\/u$/);
  }, 30_000);

  it('does not rebuild for a run it has already summed', async () => {
    const { source, requested } = bucket(20, 1);
    await source.manifest();
    const before = requested.length;
    await source.manifest();
    // Only the manifest itself again.
    expect(requested.slice(before)).toEqual(['GET https://nowcast.agroexact.com/latest.json']);
  }, 30_000);

  it('says so when even the newest run cannot be found', async () => {
    const { source } = bucket(20, 2, '2026-11-20T12-00', 49, { movedHoursAgo: 0 });
    // Everything in the root works too; nothing anywhere does not.
    await expect(source.manifest()).resolves.toBeTruthy();
    const empty = nowcastSumSource({
      fetchImpl: (async (input: RequestInfo | URL) =>
        String(input).endsWith('/latest.json')
          ? Response.json({ timestamp: new Date(ANCHOR).toISOString(), prefix: '2026-11-20T12-00', offsets: [0], bounds_3857: BOUNDS_3857 })
          : new Response(null, { status: 404 })) as typeof fetch,
      writePng: () => '',
    });
    await expect(empty.manifest()).rejects.toThrow(/newest run's frames not found/);
  }, 30_000);

  it('refuses to guess when the prefix is not the run time', async () => {
    const { source } = bucket(20, 1, 'run-42');
    await expect(source.manifest()).rejects.toThrow(/not the run time/);
  });
});
