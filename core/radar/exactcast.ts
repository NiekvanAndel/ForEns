/**
 * ExactCast radar adapter — the DGMR nowcast run.
 *
 * The model runs on our own server and publishes to `nowcast.agroexact.com`: 22
 * frames on a five-minute grid, four observed (-15..0) and eighteen forecast
 * (+5..+90). Each frame exists twice — a PNG map overlay for the radar loop, and a
 * binary grid of rain rates for reading a number at a coordinate.
 *
 * Two consequences shape this file:
 *
 *  - It is an `overlay` provider, not a tile provider. The PNGs are single 765×820
 *    images in web mercator over bounds the manifest carries, so the map pins one
 *    image to a rectangle instead of fetching a {z}/{x}/{y} pyramid.
 *  - The profile under the radar loop is the model's own millimetres per hour,
 *    sampled out of the `.bin` grids, rather than a second opinion from elsewhere.
 *    The map and the chart are then the same forecast, which they were not while
 *    the pictures and the curve came from different providers.
 *
 * The run covers the Netherlands, Belgium and western Germany and nothing else, so
 * `coversPoint` is a real check here rather than a formality — see `isWithinGrid`.
 *
 * NOTE: `nowcast.agroexact.com` is unreachable from the build environment (the
 * network policy blocks it), so the shapes below follow the DGMR readme and the
 * working client in AgroExactRN rather than a live response. Confirm the first run
 * on device.
 */
import proj4 from 'proj4';
import { fetchJson, SourceError } from '../sources/http';
import type {
  GeoBounds, NowcastBar, NowcastProfile, OverlayRadarProvider, RadarFrame, RadarFrames,
  RadarOverlay,
} from './types';

const BASE = 'https://nowcast.agroexact.com';
const MANIFEST_URL = `${BASE}/latest.json`;

/** The manifest each run publishes once every frame it names is uploaded. */
interface Manifest {
  /** ISO 8601 run time; `offsets` are minutes relative to this. */
  timestamp: string;
  /** Frame files are `{prefix}_{offset}.png` / `.bin`. */
  prefix: string;
  /** [-15..0] observed, [+5..+90] forecast. */
  offsets: number[];
  /** Web-mercator [left, bottom, right, top] of the PNG overlays. */
  bounds_3857: [number, number, number, number];
}

/** The offsets the profile is sampled at. +90 is the end of the run: a bar beyond
 *  the model's own horizon would be invention rather than forecast. */
const BAR_OFFSETS = [0, 30, 60, 90];

/** Intensity that counts as a full-height bar, mm/h. Above moderate rain the bar
 *  saturates rather than flattening everything below it. */
const FULL_SCALE_MM_H = 7.5;

/** Below this a grid cell is drizzle at most, and not worth announcing as the
 *  moment rain starts. */
const WET_MM_H = 0.2;

/** Frames are five minutes apart, which is what turns a rate into a depth. */
const FRAME_MINUTES = 5;

// --- Placing the PNGs on the map --------------------------------------------

const MERCATOR_RADIUS = 6378137;
const DEG = 180 / Math.PI;

function lonFromMercatorX(x: number): number {
  return (x / MERCATOR_RADIUS) * DEG;
}

function latFromMercatorY(y: number): number {
  return (2 * Math.atan(Math.exp(y / MERCATOR_RADIUS)) - Math.PI / 2) * DEG;
}

/**
 * The manifest's web-mercator rectangle as lat/lon.
 *
 * Computed rather than hard-coded from the readme's rounded corners: the manifest
 * carries the bounds on every run, so deriving them keeps the overlay in the right
 * place if the product's grid ever moves.
 */
export function boundsFromMercator(
  [left, bottom, right, top]: readonly [number, number, number, number]
): GeoBounds {
  return {
    west: lonFromMercatorX(left),
    east: lonFromMercatorX(right),
    south: latFromMercatorY(bottom),
    north: latFromMercatorY(top),
  };
}

// --- Sampling the binary rain-rate grid -------------------------------------
//
// The .bin frames are a row-major uint8 raster on the standard KNMI 700×765
// precipitation grid: an axis-aligned raster in polar stereographic projection. To
// sample a lon/lat, project it into that CRS and map linearly into the bounding box
// of the product corners.

const GRID_COLS = 700;
const GRID_ROWS = 765;

const KNMI_STEREO =
  '+proj=stere +lat_0=90 +lon_0=0 +lat_ts=60 +a=6378140 +b=6356750 +x_0=0 +y_0=0';

/** lon/lat in degrees → metres in the grid's stereographic CRS. */
function project(lon: number, lat: number): [number, number] {
  return proj4(KNMI_STEREO, [lon, lat]) as [number, number];
}

// Product corners (SW, NW, NE, SE); their projected bounding box spans the full
// raster, top row = max y.
const CORNER_LONS = [0.0, 0.0, 10.856453, 9.0093];
const CORNER_LATS = [49.362064, 55.973602, 55.388973, 48.8953];
const CORNERS = CORNER_LONS.map((lon, i) => project(lon, CORNER_LATS[i]!));
const X_MIN = Math.min(...CORNERS.map((c) => c[0]));
const X_MAX = Math.max(...CORNERS.map((c) => c[0]));
const Y_MIN = Math.min(...CORNERS.map((c) => c[1]));
const Y_MAX = Math.max(...CORNERS.map((c) => c[1]));

/** Whether a coordinate falls inside the radar product's grid at all. */
export function isWithinGrid(lat: number, lon: number): boolean {
  const [x, y] = project(lon, lat);
  return x >= X_MIN && x <= X_MAX && y >= Y_MIN && y <= Y_MAX;
}

/** Flat index into a .bin frame for the cell containing the coordinate. Points
 *  outside the product clamp to the nearest edge cell, so a caller that skipped
 *  `isWithinGrid` reads an edge value rather than running off the array. */
export function gridIndexFor(lat: number, lon: number): number {
  const [x, y] = project(lon, lat);
  const clamp = (v: number, hi: number) => Math.min(hi, Math.max(0, v));
  const col = clamp(Math.floor(((x - X_MIN) / (X_MAX - X_MIN)) * GRID_COLS), GRID_COLS - 1);
  const row = clamp(Math.floor(((Y_MAX - y) / (Y_MAX - Y_MIN)) * GRID_ROWS), GRID_ROWS - 1);
  return row * GRID_COLS + col;
}

/** Byte values are a 255-level geometric scale: 0 is no rain, 1..255 spans
 *  0.1..128 mm/h. */
export function decodeRainRate(v: number): number {
  return v === 0 ? 0 : 0.1 * 1280 ** ((v - 1) / 254);
}

/**
 * Turn the sampled frames into the profile the panel and the hero read.
 *
 * Samples arrive with their offsets already measured from the present, not from the
 * run time — the caller does that conversion, because the run is minutes old by the
 * time a phone reads it, and getting it wrong would put "now" on the observed side
 * of a chart whose map is showing a forecast.
 *
 * Exported for the tests, which is also the only way to exercise it without a
 * network: the sampling above needs 22 downloads, this needs an array.
 */
export function buildProfile(
  samples: readonly { offsetMin: number; mmPerHour: number }[]
): NowcastProfile {
  const bar = (offsetMin: number, mmPerHour: number): NowcastBar => ({
    offsetMin,
    mmPerHour,
    height: Math.max(4, Math.min(100, (mmPerHour / FULL_SCALE_MM_H) * 100)),
  });

  const series = samples.map((s) => bar(s.offsetMin, s.mmPerHour));

  /** The rate at an arbitrary offset, interpolated between the two frames around
   *  it — the bars sit at 30-minute marks, the frames every five. */
  const rateAt = (offsetMin: number): number => {
    if (!series.length) return 0;
    const first = series[0]!;
    const last = series[series.length - 1]!;
    if (offsetMin <= first.offsetMin) return first.mmPerHour;
    if (offsetMin >= last.offsetMin) return last.mmPerHour;
    for (let i = 1; i < series.length; i++) {
      const a = series[i - 1]!;
      const b = series[i]!;
      if (offsetMin <= b.offsetMin) {
        const span = b.offsetMin - a.offsetMin || 1;
        const f = (offsetMin - a.offsetMin) / span;
        return a.mmPerHour + (b.mmPerHour - a.mmPerHour) * f;
      }
    }
    return last.mmPerHour;
  };

  const bars = BAR_OFFSETS.map((o) => bar(o, rateAt(o)));

  // Everything from the present onwards. The observed frames behind us belong on
  // the chart, but not in a total of what is still to fall.
  const forward = series.filter((b) => b.offsetMin >= 0);

  // Each frame stands for five minutes, so a rate becomes a depth.
  const totalMm = forward.reduce((sum, b) => sum + (b.mmPerHour * FRAME_MINUTES) / 60, 0);

  const firstWet = forward.find((b) => b.mmPerHour > WET_MM_H);
  const startsInMin = firstWet ? firstWet.offsetMin : null;

  // Skill decays with lead time even for a generative model, so a shower predicted
  // at the end of the run is worth less than one already on the radar.
  const horizon = forward.length ? forward[forward.length - 1]!.offsetMin : 90;
  const confidence =
    startsInMin == null ? 90 : Math.max(45, 95 - (startsInMin / Math.max(1, horizon)) * 45);

  return {
    bars,
    series,
    totalMm: Math.round(totalMm * 10) / 10,
    confidence: Math.round(confidence),
    startsInMin,
    wet: totalMm > 0.1,
  };
}

export class ExactCastProvider implements OverlayRadarProvider {
  readonly kind = 'overlay' as const;
  readonly id = 'exactcast';
  readonly label = 'ExactCast AI nowcast';
  readonly attribution = 'ExactCast · KNMI radar';

  /**
   * The overlay is one 765×820 image over roughly seven degrees of latitude, so
   * about a kilometre per pixel — the resolution of the radar product itself.
   * Past this the map simply scales the image up, which loses nothing that was
   * ever in the data.
   */
  readonly maxZoom = 10;

  /** The run currently on screen. Held so `frameOverlay` can answer synchronously
   *  during render, and so a second screen does not refetch the manifest. */
  private run: { manifest: Manifest; bounds: GeoBounds; fetchedMs: number } | null = null;

  /** One run sampled at one place. The frames are immutable, so this is only
   *  invalidated by a new run or a different location — which is exactly what the
   *  key holds. */
  private profileCache: { key: string; profile: NowcastProfile } | null = null;

  coversPoint(lat: number, lon: number): boolean {
    return isWithinGrid(lat, lon);
  }

  /**
   * The current run's manifest.
   *
   * `latest.json` is served `no-cache` and must genuinely be refetched — a cached
   * copy would pin the app to a run that has already rolled off the bucket. The
   * short in-memory window only stops the two radar screens fetching it twice in
   * the same breath.
   */
  private async loadRun(signal?: AbortSignal) {
    if (this.run && Date.now() - this.run.fetchedMs < 60_000) return this.run;
    const manifest = await fetchJson<Manifest>(MANIFEST_URL, 'ExactCast', {
      signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!manifest?.prefix || !Array.isArray(manifest.offsets) || !manifest.offsets.length) {
      throw new SourceError('ExactCast', 'manifest has no frames');
    }
    // A run whose last frame is already behind us has nothing left to forecast:
    // the server has missed its schedule, and drawing the loop anyway would
    // present a stale hour and a half as the coming one. The screens say the radar
    // is temporarily unavailable, which is the truth.
    const runMs = Date.parse(manifest.timestamp);
    const endsMs = runMs + Math.max(...manifest.offsets) * 60_000;
    if (!Number.isFinite(runMs) || endsMs < Date.now()) {
      throw new SourceError('ExactCast', 'the published run has expired');
    }
    this.run = {
      manifest,
      bounds: boundsFromMercator(manifest.bounds_3857),
      fetchedMs: Date.now(),
    };
    return this.run;
  }

  async listFrames(signal?: AbortSignal): Promise<RadarFrames> {
    const { manifest } = await this.loadRun(signal);
    const runMs = Date.parse(manifest.timestamp);
    // The frame handle is `{prefix}_{offset}`, which both the PNG and the .bin
    // hang off — so a frame carries everything either needs without a lookup.
    const frames = manifest.offsets.map((offset) => ({
      timeMs: runMs + offset * 60_000,
      forecast: offset > 0,
      id: `${manifest.prefix}_${offset}`,
    }));
    return {
      past: frames.filter((f) => !f.forecast),
      forecast: frames.filter((f) => f.forecast),
    };
  }

  frameOverlay(frame: RadarFrame): RadarOverlay | null {
    if (!this.run) return null;
    return { url: `${BASE}/${frame.id}.png`, bounds: this.run.bounds };
  }

  frameImageUrls(frames: readonly RadarFrame[]): string[] {
    return frames.map((f) => `${BASE}/${f.id}.png`);
  }

  async nowcastProfile(lat: number, lon: number, signal?: AbortSignal): Promise<NowcastProfile> {
    if (!this.coversPoint(lat, lon)) {
      throw new SourceError('ExactCast', 'location is outside the radar grid');
    }
    const { manifest } = await this.loadRun(signal);
    const key = `${manifest.prefix}@${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (this.profileCache?.key === key) return this.profileCache.profile;

    const index = gridIndexFor(lat, lon);
    const runMs = Date.parse(manifest.timestamp);
    const nowMs = Date.now();

    const samples = await Promise.all(
      manifest.offsets.map(async (offset) => ({
        // Against the clock, not against the run: by the time a phone reads a run
        // it is already minutes old.
        offsetMin: Math.round((runMs + offset * 60_000 - nowMs) / 60_000),
        mmPerHour: await fetchFrameRate(`${BASE}/${manifest.prefix}_${offset}.bin`, index, signal),
      }))
    );

    const profile = buildProfile(samples);
    this.profileCache = { key, profile };
    return profile;
  }
}

/** Downloads one .bin frame and reads the mm/h at one grid cell.
 *
 *  The files are gzipped and served with `Content-Encoding: gzip`, so fetch hands
 *  back exactly 535 500 decompressed bytes. A frame of the wrong size is a changed
 *  product rather than a bad pixel, and is worth failing on. */
async function fetchFrameRate(url: string, index: number, signal?: AbortSignal): Promise<number> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new SourceError('ExactCast', `HTTP ${response.status}`, response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== GRID_ROWS * GRID_COLS) {
    throw new SourceError('ExactCast', `unexpected frame size ${bytes.length}`);
  }
  return decodeRainRate(bytes[index]!);
}
