/**
 * The rainfall total built on the phone, from the nowcast's own observed frames.
 *
 * Interim route, until the server-side layers in `./cumulative` (`httpSource`) are
 * reachable. Every nowcast run publishes its four latest *observed* radar frames
 * next to the forecast — offsets -15, -10, -5 and 0 — as gauge-calibrated `.bin`
 * grids of mm/h. A total over a window is the sum of the observed frames in it, each
 * divided by 12 because a frame stands for five minutes. That is all this file does,
 * plus enough around it to hand the map exactly what `CumulativeSource` promises: a
 * manifest, a PNG per window, and a raster of tenths of a millimetre.
 *
 * ## Guessing the file names
 *
 * `latest.json` names only the newest run, and frame files are named after the run
 * that published them, not after the moment they show. So the runs behind it are
 * found by probing: every five-minute mark of the last day is a candidate run time,
 * and a HEAD on its `_0.bin` says whether that run exists. Each run found covers the
 * twenty minutes up to its own time; a five-minute slot no run covers is counted as
 * missing, and the window's `hours_found` says so.
 *
 * Two assumptions hold this up, and both are checked rather than trusted:
 *
 *  - **The prefix is the run time in UTC, `YYYY-MM-DDTHH-MM`.** Checked against the
 *    newest manifest; if it does not hold, the layer fails loudly instead of probing
 *    288 names that cannot exist.
 *  - **Runs fall on five-minute marks.** A run at 10:31 would never be probed and its
 *    frames would read as missing. Not checkable from here; the coverage figure is
 *    where it would show.
 *
 * With the nowcast every half hour only 8 of every 12 frames exist, so a total is
 * about a third short. The provenance line under the figure says how many frames
 * there were, because a number that is a floor must not read as a measurement.
 *
 * ## Cost
 *
 * Two days is 576 frames: in wet weather some 40 MB over the network and a few
 * seconds of arithmetic. Slow to load, and accepted as such. The bucket keeps about
 * two days, so the oldest hours of the 48 hour window may already be gone; they then
 * count as missing and the provenance line says so, as for any other gap. Frames are
 * summed as they arrive and never kept, so memory stays at six window-sized float
 * grids.
 */
import { SourceError } from '../sources/http';
import {
  GRID_COLS, GRID_ROWS, NOWCAST_BIN_BASE, NOWCAST_MANIFEST_URL,
  boundsFromMercator, decodeRainRate, gridCellAt, type NowcastManifest,
} from './exactcast';
import type {
  CumulativeLegend, CumulativeManifest, CumulativeSource, CumulativeWindow,
} from './cumulative';

/** The windows offered, shortest first. 48 hours reaches the edge of what the bucket
 *  keeps, so it is the one most likely to be short. */
export const SUM_WINDOW_HOURS = [1, 3, 6, 12, 24, 48] as const;

/**
 * The server's colour ramp for rainfall totals, as `docs/exactcast-cumulative-radar.md`
 * publishes it — copied so this route draws in the same colours without the dummy
 * build in the bundle. A test holds it equal to the fixture's.
 */
export const SUM_LEGEND: CumulativeLegend = {
  bounds_mm: [0.5, 3, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90],
  colors: [
    '#0399FE', '#0000E8', '#00006A', '#00D4AB', '#028703', '#45BE00', '#00E600',
    '#9E9E04', '#FFFC0B', '#FEA601', '#C64900', '#910000', '#FF004A',
  ],
  dry_below_mm: 0.5,
};

/** The size of the nowcast's own PNGs, over the same `bounds_3857`. */
export const SUM_RASTER_COLS = 765;
export const SUM_RASTER_ROWS = 820;

const SLOT_MIN = 5;
const SLOT_MS = SLOT_MIN * 60_000;
const FRAMES_PER_HOUR = 60 / SLOT_MIN;
/** Observed offsets every run publishes, oldest frame first. */
const OBSERVED_OFFSETS = [-15, -10, -5, 0] as const;
const GRID_CELLS = GRID_COLS * GRID_ROWS;

// --- File names ---------------------------------------------------------------

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** A run's prefix from its time: `2026-08-19T10-30`, UTC. */
export function runPrefix(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}`
  );
}

export function frameUrl(runMs: number, offsetMin: number): string {
  return `${NOWCAST_BIN_BASE}/${runPrefix(runMs)}_${offsetMin}.bin`;
}

/**
 * The run times worth probing: every five-minute mark from just before the newest
 * run back to the oldest slot of the longest window. A run older than that slot
 * publishes nothing inside the window.
 */
export function candidateRuns(anchorMs: number, hours: number): number[] {
  const oldestSlot = anchorMs - hours * 3_600_000 + SLOT_MS;
  const out: number[] = [];
  for (let t = anchorMs - SLOT_MS; t >= oldestSlot; t -= SLOT_MS) out.push(t);
  return out;
}

/** One five-minute slot of the window and the frame chosen for it. */
export interface PlannedFrame {
  slotMs: number;
  /** Null when no run found covers the slot. */
  url: string | null;
}

/**
 * Which file to read for each slot, newest first.
 *
 * Where two runs both carry a slot — they can, if the runs are closer together than
 * twenty minutes — the newer run wins: it was calibrated with more of the gauges'
 * reports in.
 */
export function planFrames(anchorMs: number, hours: number, runs: readonly number[]): PlannedFrame[] {
  const known = new Set(runs);
  known.add(anchorMs);
  const plan: PlannedFrame[] = [];
  const slots = hours * FRAMES_PER_HOUR;
  for (let i = 0; i < slots; i++) {
    const slotMs = anchorMs - i * SLOT_MS;
    let url: string | null = null;
    // Newest covering run first: offset -15 is the run a quarter of an hour after
    // the slot, offset 0 the run at the slot itself.
    for (const offset of OBSERVED_OFFSETS) {
      const runMs = slotMs - offset * 60_000;
      if (runMs <= anchorMs && known.has(runMs)) {
        url = frameUrl(runMs, offset);
        break;
      }
    }
    plan.push({ slotMs, url });
  }
  return plan;
}

// --- Summing ------------------------------------------------------------------

/** Millimetres a frame byte stands for over its five minutes. */
const DEPTH_LUT = Float32Array.from({ length: 256 }, (_, v) => decodeRainRate(v) / FRAMES_PER_HOUR);

/**
 * Running totals for nesting windows.
 *
 * Each frame is added to the band its slot falls in — band 0 is the newest hour,
 * band 1 the two hours before it, and so on — and a window is the sum of the bands
 * up to its own. Frames can then arrive in any order, which they do when fetched in
 * parallel, and are dropped as soon as they are added.
 */
export class WindowAccumulator {
  readonly bands: Float32Array[];
  readonly found: number[];

  constructor(
    readonly anchorMs: number,
    readonly hours: readonly number[]
  ) {
    this.bands = hours.map(() => new Float32Array(GRID_CELLS));
    this.found = hours.map(() => 0);
  }

  /** The band a slot belongs to, or -1 outside the longest window. */
  bandOf(slotMs: number): number {
    const ageH = (this.anchorMs - slotMs) / 3_600_000;
    if (ageH < 0) return -1;
    return this.hours.findIndex((h) => ageH < h);
  }

  add(slotMs: number, frame: Uint8Array): void {
    const band = this.bandOf(slotMs);
    if (band < 0) return;
    if (frame.length !== GRID_CELLS) {
      throw new SourceError('ExactCast', `unexpected frame size ${frame.length}`);
    }
    const sum = this.bands[band]!;
    for (let i = 0; i < GRID_CELLS; i++) sum[i]! += DEPTH_LUT[frame[i]!]!;
    this.found[band]! += 1;
  }

  /** The total for the `k`th window, in millimetres on the radar grid. */
  window(k: number): { mm: Float32Array; frames: number } {
    const mm = new Float32Array(GRID_CELLS);
    let frames = 0;
    for (let b = 0; b <= k; b++) {
      const band = this.bands[b]!;
      for (let i = 0; i < GRID_CELLS; i++) mm[i]! += band[i]!;
      frames += this.found[b]!;
    }
    return { mm, frames };
  }
}

// --- Onto the map -------------------------------------------------------------

const MERCATOR_RADIUS = 6378137;
const DEG = 180 / Math.PI;

/** Lets a long loop hand the JS thread back now and then, so the map keeps
 *  panning while a lookup table is built. */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * For every pixel of the map image, the radar cell under its centre (-1 outside).
 *
 * The radar grid is polar stereographic and the map is Web Mercator, so this is a
 * projection per pixel — about 630 000 of them. It depends only on the bounds,
 * which do not change between runs, so it is built once.
 */
export async function mercatorLookup(
  bounds3857: readonly [number, number, number, number],
  cols = SUM_RASTER_COLS,
  rows = SUM_RASTER_ROWS
): Promise<Int32Array> {
  const [left, bottom, right, top] = bounds3857;
  const lookup = new Int32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const y = top - ((r + 0.5) / rows) * (top - bottom);
    const lat = (2 * Math.atan(Math.exp(y / MERCATOR_RADIUS)) - Math.PI / 2) * DEG;
    for (let c = 0; c < cols; c++) {
      const x = left + ((c + 0.5) / cols) * (right - left);
      lookup[r * cols + c] = gridCellAt(lat, (x / MERCATOR_RADIUS) * DEG);
    }
    if (r % 64 === 63) await breathe();
  }
  return lookup;
}

/** A total on the radar grid, resampled onto the map image as tenths of a mm. */
export function toMapRaster(mm: Float32Array, lookup: Int32Array): { values: Uint16Array; maxMm: number } {
  const values = new Uint16Array(lookup.length);
  let max = 0;
  for (let i = 0; i < lookup.length; i++) {
    const cell = lookup[i]!;
    if (cell < 0) continue;
    const v = mm[cell]!;
    if (v > max) max = v;
    values[i] = Math.min(65535, Math.round(v * 10));
  }
  return { values, maxMm: Math.round(max * 10) / 10 };
}

// --- PNG ----------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [0, 0, 0];
}

/**
 * A palette PNG of the totals: index 0 transparent (dry), index i+1 the legend's
 * i-th class.
 *
 * Written out by hand with *stored* deflate blocks, so the app needs no compression
 * library. The file is about 630 KB, which is nothing for a cache directory and
 * decodes as fast as any other PNG — only the bytes over the network are worth
 * squeezing, and these never travel.
 */
export function encodeTotalsPng(
  values: Uint16Array,
  cols: number,
  rows: number,
  legend: CumulativeLegend,
  scale = 10
): Uint8Array {
  const classes = legend.bounds_mm.length;
  const dry = Math.max(legend.dry_below_mm, legend.bounds_mm[0] ?? 0);
  // Tenths of a mm per class edge, so the per-pixel test is integer.
  const edges = legend.bounds_mm.map((b) => b * scale);
  const dryEdge = dry * scale;

  // Scanlines: a filter byte (0, none) and then a palette index per pixel.
  const stride = cols + 1;
  const raw = new Uint8Array(stride * rows);
  for (let r = 0; r < rows; r++) {
    const o = r * stride;
    for (let c = 0; c < cols; c++) {
      const v = values[r * cols + c]!;
      if (v < dryEdge) continue;
      let k = 0;
      while (k < classes && v >= edges[k]!) k++;
      raw[o + 1 + c] = k; // k ≥ 1 here, because v ≥ dry ≥ the first edge
    }
  }

  // zlib: header, stored blocks of up to 65 535 bytes, Adler-32.
  const blocks = Math.max(1, Math.ceil(raw.length / 65535));
  const zlib = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  zlib[0] = 0x78;
  zlib[1] = 0x01;
  let p = 2;
  for (let b = 0; b < blocks; b++) {
    const start = b * 65535;
    const len = Math.min(65535, raw.length - start);
    zlib[p++] = b === blocks - 1 ? 1 : 0;
    zlib[p++] = len & 255;
    zlib[p++] = len >>> 8;
    zlib[p++] = ~len & 255;
    zlib[p++] = (~len >>> 8) & 255;
    zlib.set(raw.subarray(start, start + len), p);
    p += len;
  }
  let a = 1;
  let bsum = 0;
  for (let i = 0; i < raw.length; i++) {
    a = (a + raw[i]!) % 65521;
    bsum = (bsum + a) % 65521;
  }
  const adler = ((bsum << 16) | a) >>> 0;
  zlib[p++] = adler >>> 24;
  zlib[p++] = (adler >>> 16) & 255;
  zlib[p++] = (adler >>> 8) & 255;
  zlib[p++] = adler & 255;

  const palette = new Uint8Array(3 * (classes + 1));
  const alpha = new Uint8Array(classes + 1);
  for (let k = 0; k < classes; k++) {
    palette.set(hexToRgb(legend.colors[k] ?? '#000000'), 3 * (k + 1));
    alpha[k + 1] = 255;
  }

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, cols);
  view.setUint32(4, rows);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // palette

  const chunks: [string, Uint8Array][] = [
    ['IHDR', ihdr], ['PLTE', palette], ['tRNS', alpha], ['IDAT', zlib], ['IEND', new Uint8Array(0)],
  ];
  const size = 8 + chunks.reduce((n, [, d]) => n + 12 + d.length, 0);
  const png = new Uint8Array(size);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const out = new DataView(png.buffer);
  let q = 8;
  for (const [type, data] of chunks) {
    out.setUint32(q, data.length);
    for (let i = 0; i < 4; i++) png[q + 4 + i] = type.charCodeAt(i);
    png.set(data, q + 8);
    out.setUint32(q + 8 + data.length, crc32(png, q + 4, q + 8 + data.length));
    q += 12 + data.length;
  }
  return png;
}

// --- The source ---------------------------------------------------------------

export interface NowcastSumOptions {
  /** The colour ramp; defaults to the server's own, so the two routes draw alike. */
  legend?: CumulativeLegend;
  /** Stores a PNG and returns a URI the map can load. */
  writePng: (name: string, bytes: Uint8Array) => Promise<string> | string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Requests in flight at once. */
  concurrency?: number;
  /** Frames read so far of those planned, for a progress line. */
  onProgress?: (done: number, total: number) => void;
}

interface Built {
  prefix: string;
  manifest: CumulativeManifest;
  rasters: Map<number, Uint16Array>;
}

async function pool<T>(items: readonly T[], size: number, work: (item: T) => Promise<void>) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await work(items[next++]!);
  });
  await Promise.all(lanes);
}

/** The frames' share of the slots, in hours, to one decimal. */
const asHours = (frames: number) => Math.round((frames / FRAMES_PER_HOUR) * 10) / 10;

export function nowcastSumSource(options: NowcastSumOptions): CumulativeSource {
  const { legend = SUM_LEGEND, writePng, fetchImpl = fetch, now = Date.now, concurrency = 8, onProgress } = options;

  // Whether a run exists. A run that exists stays; one that did not is only final
  // once it is well behind us — a run can still be uploading at the newest marks.
  const runExists = new Map<number, boolean>();
  let lookup: { key: string; table: Promise<Int32Array> } | null = null;
  let built: Built | null = null;
  let building: Promise<Built> | null = null;

  const probe = async (runMs: number): Promise<boolean> => {
    const cached = runExists.get(runMs);
    if (cached != null) return cached;
    const url = frameUrl(runMs, 0);
    let ok = false;
    try {
      let res = await fetchImpl(url, { method: 'HEAD' });
      if (res.status === 405 || res.status === 501) {
        res = await fetchImpl(url, { headers: { Range: 'bytes=0-0' } });
      }
      ok = res.ok;
    } catch {
      return false; // a dropped request is not evidence either way, so not cached
    }
    if (ok || now() - runMs > 60 * 60_000) runExists.set(runMs, ok);
    return ok;
  };

  const readFrame = async (url: string): Promise<Uint8Array | null> => {
    try {
      const res = await fetchImpl(url);
      if (!res.ok) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      return bytes.length === GRID_CELLS ? bytes : null;
    } catch {
      return null;
    }
  };

  const build = async (run: NowcastManifest): Promise<Built> => {
    const anchorMs = Date.parse(run.timestamp);
    if (!Number.isFinite(anchorMs)) throw new SourceError('ExactCast', 'manifest has no run time');
    // The whole of the guessing rests on this, so it is checked, not assumed.
    if (runPrefix(anchorMs) !== run.prefix) {
      throw new SourceError(
        'ExactCast',
        `prefix "${run.prefix}" is not the run time ${runPrefix(anchorMs)}; cannot find older runs`
      );
    }
    runExists.set(anchorMs, true);
    const longest = SUM_WINDOW_HOURS[SUM_WINDOW_HOURS.length - 1]!;

    const found: number[] = [];
    await pool(candidateRuns(anchorMs, longest), concurrency, async (t) => {
      if (await probe(t)) found.push(t);
    });

    const plan = planFrames(anchorMs, longest, found).filter((f) => f.url);
    const acc = new WindowAccumulator(anchorMs, SUM_WINDOW_HOURS);
    let done = 0;
    onProgress?.(0, plan.length);
    await pool(plan, concurrency, async (f) => {
      const frame = await readFrame(f.url!);
      if (frame) acc.add(f.slotMs, frame);
      onProgress?.(++done, plan.length);
    });

    const key = run.bounds_3857.join(',');
    if (!lookup || lookup.key !== key) lookup = { key, table: mercatorLookup(run.bounds_3857) };
    const table = await lookup.table;

    const anchorIso = new Date(anchorMs).toISOString();
    const windows: CumulativeWindow[] = [];
    const rasters = new Map<number, Uint16Array>();
    for (let k = 0; k < SUM_WINDOW_HOURS.length; k++) {
      const hours = SUM_WINDOW_HOURS[k]!;
      const { mm, frames } = acc.window(k);
      const { values, maxMm } = toMapRaster(mm, table);
      const png = encodeTotalsPng(values, SUM_RASTER_COLS, SUM_RASTER_ROWS, legend);
      const uri = await writePng(`cumulative-${run.prefix}-${hours}h.png`, png);
      rasters.set(hours, values);
      windows.push({
        hours,
        start: new Date(anchorMs - hours * 3_600_000).toISOString(),
        end: anchorIso,
        hours_expected: hours,
        hours_found: asHours(frames),
        hours_calibrated: asHours(frames),
        complete: frames === hours * FRAMES_PER_HOUR,
        max_mm: maxMm,
        png_url: uri,
        values_url: '',
      });
      await breathe();
    }

    return {
      prefix: run.prefix,
      rasters,
      manifest: {
        anchor: anchorIso,
        generated_at: new Date(now()).toISOString(),
        calibrated: true,
        source: 'nowcast',
        projection: 'EPSG:3857',
        bounds_3857: run.bounds_3857,
        bounds_wgs84: boundsFromMercator(run.bounds_3857),
        raster: {
          rows: SUM_RASTER_ROWS, cols: SUM_RASTER_COLS, dtype: 'uint16',
          byte_order: 'little', scale: 10, unit: 'mm',
        },
        legend,
        windows,
      },
    };
  };

  const fetchManifest = async (signal?: AbortSignal): Promise<NowcastManifest> => {
    const res = await fetchImpl(NOWCAST_MANIFEST_URL, { signal, headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new SourceError('ExactCast', `HTTP ${res.status}`, res.status);
    const run = (await res.json()) as NowcastManifest;
    if (!run?.prefix || !run.timestamp || !Array.isArray(run.bounds_3857)) {
      throw new SourceError('ExactCast', 'manifest is incomplete');
    }
    return run;
  };

  return {
    async manifest(signal) {
      const run = await fetchManifest(signal);
      if (built?.prefix === run.prefix) return built.manifest;
      // One build at a time, and not tied to the caller's signal: switching the layer
      // off and on again should find the work further along, not start it over.
      if (!building) {
        building = build(run)
          .then((b) => (built = b))
          .finally(() => {
            building = null;
          });
      }
      const pending = building;
      return new Promise<CumulativeManifest>((resolve, reject) => {
        const onAbort = () => {
          const e = new Error('Aborted');
          e.name = 'AbortError';
          reject(e);
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        pending.then(
          (b) => resolve(b.manifest),
          (e: unknown) => reject(e)
        ).finally(() => signal?.removeEventListener('abort', onAbort));
      });
    },

    overlayUrl(window) {
      return window.png_url;
    },

    async values(window) {
      const raster = built?.rasters.get(window.hours);
      if (!raster) throw new Error(`cumulative: no raster for ${window.hours}h`);
      return raster;
    },
  };
}

/** The share of five-minute frames a window actually had, 0..1. */
export function frameShare(window: CumulativeWindow): number {
  return window.hours_expected > 0 ? Math.min(1, window.hours_found / window.hours_expected) : 0;
}
