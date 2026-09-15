/**
 * Cumulative calibrated radar — gauge-corrected rainfall totals over a look-back
 * window, as an extra layer on the full-screen map.
 *
 * The backend publishes six windows — 1, 3, 6, 12, 24 and 48 hours — that all end on
 * the same anchor, so they nest: the 24 hour field is the newest 24 hours of the 48
 * hour one. Each window exists twice, exactly as the nowcast frames do: a palette PNG
 * to drape over a rectangle, and a raw value raster to read a number out of.
 *
 * The contract is `docs/exactcast-cumulative-radar.md` in AgroExactWebApp. Three
 * things in it are load-bearing and are honoured here rather than in the screens:
 *
 *  - **The manifest owns every URL.** `png_url` and `values_url` arrive with an
 *    `?anchor=` stamp so a new hour can never be served out of the previous hour's
 *    HTTP cache. Nothing here builds one; they are used as given.
 *  - **The manifest owns the legend and the raster.** Both can change server-side
 *    without an app release, so the ramp is read from `legend` and every sampled
 *    read-out is placed with `raster.rows`/`raster.cols` — never with constants.
 *  - **A 503 is not an error.** It means the layers have not been built yet, and it
 *    carries `Retry-After`. It is a state the UI shows, which is why it has its own
 *    error class instead of arriving as a failed fetch.
 *
 * ## The slider runs from the last hour outwards
 *
 * Every window ends at `anchor`, so what varies between them is where they *start*
 * and therefore how much they have had time to collect. The slider is that length:
 * the last hour at the left, two days at the right, and dragging right reaches
 * further back and shows a larger total. Which is also the direction the play head
 * moves, so the thumb never runs backwards while the total climbs.
 *
 * The anchor itself is never "now" — the hourly radar for hour H is stored at H:10,
 * so the newest window can end up to about seventy minutes ago, and saying "now"
 * would be a lie the size of a shower.
 */
import type { GeoBounds } from './types';

/** The look-back windows the backend publishes, shortest first — the order the map's
 *  slider runs in, so dragging right lengthens the window. */
export const WINDOW_HOURS = [1, 3, 6, 12, 24, 48] as const;

/** Little-endian uint16 tenths of a millimetre; the manifest's `raster.scale` is what
 *  actually divides, this is only what the raster is expected to be. */
const EXPECTED_DTYPE = 'uint16';

const MERCATOR_RADIUS = 6378137;
const RAD = Math.PI / 180;

/** The value raster, as the manifest describes it. */
export interface CumulativeRaster {
  rows: number;
  cols: number;
  dtype: string;
  byte_order: string;
  /** Stored value divided by this is millimetres. */
  scale: number;
  unit: string;
}

/**
 * The colour ramp, which the server may change without an app release.
 *
 * `bounds_mm[i]` is the lower bound of the class drawn in `colors[i]`, so the two
 * arrays are the same length and a value below `bounds_mm[0]` is dry.
 */
export interface CumulativeLegend {
  bounds_mm: number[];
  colors: string[];
  dry_below_mm: number;
}

/** One published look-back window. */
export interface CumulativeWindow {
  hours: number;
  /** Exclusive start (UTC ISO); `anchor` minus `hours`. */
  start: string;
  /** Inclusive end (UTC ISO) — the anchor every window shares. */
  end: string;
  hours_expected: number;
  /** Radar hours that were actually there. Below `hours_expected` the total is an
   *  under-estimate, which the UI has to say out loud. */
  hours_found: number;
  /** Of those, how many had a gauge calibration factor. The rest are raw radar. */
  hours_calibrated: number;
  complete: boolean;
  max_mm: number;
  png_url: string;
  values_url: string;
}

export interface CumulativeManifest {
  /** UTC ISO. Every window ends here, and it is not "now". */
  anchor: string;
  generated_at: string;
  calibrated: boolean;
  /** "radar" for the real pipeline, "dummy" for synthetic front-end fixtures. */
  source: string;
  projection: string;
  /** [left, bottom, right, top] in EPSG:3857 — the same rectangle as `bounds_wgs84`. */
  bounds_3857: [number, number, number, number];
  bounds_wgs84: GeoBounds;
  raster: CumulativeRaster;
  legend: CumulativeLegend;
  windows: CumulativeWindow[];
}

/**
 * The layers are not built yet.
 *
 * The backend answers 503 with `Retry-After` while its cache is cold and a rebuild is
 * queued. That is a state to render — "not available yet" — rather than a failure, so
 * callers can tell it apart from a dead network.
 */
export class CumulativeUnavailable extends Error {
  constructor(readonly retryAfterSec: number) {
    super(`Cumulative layers not built yet; retry in ${retryAfterSec}s`);
    this.name = 'CumulativeUnavailable';
  }
}

/**
 * Where the layers come from.
 *
 * Two implementations exist: the bundled fixtures in `./fixture`, and `httpSource`
 * below. Screens never touch either directly — they take whichever they are given —
 * so moving from the dummy build to the live endpoints changes one line of wiring
 * and nothing in the UI.
 */
export interface CumulativeSource {
  /** The manifest. Throws `CumulativeUnavailable` while nothing is built. */
  manifest(signal?: AbortSignal): Promise<CumulativeManifest>;
  /** What the map draws for a window — whatever the map library can load. */
  overlayUrl(window: CumulativeWindow): string;
  /** The window's value raster, already decoded to tenths of a millimetre. */
  values(window: CumulativeWindow, signal?: AbortSignal): Promise<Uint16Array>;
}

// --- Geometry ---------------------------------------------------------------

function mercatorX(lon: number): number {
  return MERCATOR_RADIUS * lon * RAD;
}

function mercatorY(lat: number): number {
  return MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
}

/** The rectangle the overlay is draped over. A lat/lon box is an exact rectangle in
 *  Web Mercator, so this is the same shape as `bounds_3857` and either will do. */
export function overlayBounds(manifest: CumulativeManifest): GeoBounds {
  return { ...manifest.bounds_wgs84 };
}

/**
 * The raster cell a coordinate falls in, or null outside the published crop.
 *
 * The crop is tighter than the nowcast layer's — it is the largest box entirely
 * inside the area the gauge calibration covers — so a saved location can genuinely
 * fall outside it, and "no cell" is an answer the UI has to be able to give.
 *
 * The mapping is linear in Web Mercator, not in degrees: the raster is an EPSG:3857
 * image, and interpolating its rows linearly in latitude would drift by kilometres
 * across four degrees of it.
 */
export function pixelFor(
  manifest: CumulativeManifest,
  lat: number,
  lon: number
): { row: number; col: number } | null {
  const [left, bottom, right, top] = manifest.bounds_3857;
  const { rows, cols } = manifest.raster;
  if (!(rows > 0 && cols > 0) || right <= left || top <= bottom) return null;

  const fx = (mercatorX(lon) - left) / (right - left);
  // Row 0 is the north edge, so the fraction runs down from the top.
  const fy = (top - mercatorY(lat)) / (top - bottom);
  if (!(fx >= 0 && fx < 1 && fy >= 0 && fy < 1)) return null;

  return { row: Math.floor(fy * rows), col: Math.floor(fx * cols) };
}

/**
 * Millimetres at a coordinate, or null where the layer has nothing to say.
 *
 * `values` is row-major on exactly the raster the manifest describes, which is why
 * the dimensions are read from the manifest rather than assumed: a fixture build and
 * a production build do not have to agree about raster size for this to be right.
 */
export function sampleMm(
  manifest: CumulativeManifest,
  values: Uint16Array,
  lat: number,
  lon: number
): number | null {
  const at = pixelFor(manifest, lat, lon);
  if (!at) return null;
  const cols = manifest.raster.cols;
  // A manifest claiming scale 0 would turn every reading into Infinity; millimetres
  // are what the raster stores, so unscaled is the honest fallback.
  const scale = manifest.raster.scale || 1;
  const offset = at.row * cols + at.col;
  if (offset < 0 || offset >= values.length) return null;
  return values[offset]! / scale;
}

// --- Reading the manifest ---------------------------------------------------

/** The published window of a given length, or undefined if the server dropped it. */
export function windowOf(
  manifest: CumulativeManifest,
  hours: number
): CumulativeWindow | undefined {
  return manifest.windows.find((w) => w.hours === hours);
}

/**
 * The windows in the order the slider runs: shortest first.
 *
 * The track's left-hand end is the last hour and its right-hand end is the longest
 * window, so dragging right — and playing, which moves the same way — lengthens the
 * window and grows the total. A track ordered the other way is a defensible time
 * axis, and it reads as the slider running backwards under a rising number.
 *
 * Driven by what the manifest actually carries rather than by `WINDOW_HOURS`, so a
 * server that publishes a different set is drawn rather than half-drawn.
 */
export function slidingWindows(manifest: CumulativeManifest): CumulativeWindow[] {
  return [...manifest.windows].sort((a, b) => a.hours - b.hours);
}

/** How a window's coverage departs from what it asked for. */
export interface Coverage {
  /** Radar hours that never arrived. The total is an under-estimate by this much. */
  missing: number;
  /** Hours that fell back to raw radar because no calibration factor existed. */
  uncalibrated: number;
}

export function coverageOf(window: CumulativeWindow): Coverage {
  return {
    missing: Math.max(0, window.hours_expected - window.hours_found),
    uncalibrated: Math.max(0, window.hours_found - window.hours_calibrated),
  };
}

/**
 * The colour a total is drawn in, or null when it is below the dry threshold.
 *
 * Built from the manifest's own ramp so the legend under the map and the pixels on it
 * can never disagree, and so a server-side change to the ramp needs no release.
 */
export function legendColorFor(legend: CumulativeLegend, mm: number): string | null {
  let color: string | null = null;
  for (let i = 0; i < legend.bounds_mm.length; i++) {
    if (mm >= legend.bounds_mm[i]!) color = legend.colors[i] ?? color;
    else break;
  }
  return color;
}

/** One block of the legend: its colour and the range it stands for. */
export interface LegendStop {
  color: string;
  from: number;
  /** Null on the last stop, which is open-ended. */
  to: number | null;
}

export function legendStops(legend: CumulativeLegend): LegendStop[] {
  return legend.bounds_mm.map((from, i) => ({
    color: legend.colors[i] ?? '#000000',
    from,
    to: i + 1 < legend.bounds_mm.length ? legend.bounds_mm[i + 1]! : null,
  }));
}

// --- Labels -----------------------------------------------------------------

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** A UTC instant on the device's own clock, `HH:MM` — as `frameClock` does it, so
 *  the anchor badge and the radar loop's badge read the same way. */
export function clockAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * How the slider's position reads: the moment the total is counted from.
 *
 * "sinds 09:00" while that is today, "sinds gisteren 12:00" once it is not — a bare
 * clock time on a 48 hour window would be read as this morning.
 */
export function sinceLabel(window: CumulativeWindow, now: Date = new Date()): string {
  const start = new Date(window.start);
  if (Number.isNaN(start.getTime())) return '';
  const clock = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const today = new Date(now);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const nowDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((nowDay.getTime() - startDay.getTime()) / 86_400_000);
  if (days <= 0) return `sinds ${clock}`;
  if (days === 1) return `sinds gisteren ${clock}`;
  if (days === 2) return `sinds eergisteren ${clock}`;
  return `sinds ${pad(start.getDate())}-${pad(start.getMonth() + 1)} ${clock}`;
}

/**
 * A window as a point in the past — how the chart's axis and the map's badge name it.
 *
 * Signed, and that is the whole point of it: a bare "48u" beside a rising total reads
 * as a forecast running two days out, which is the opposite of what this layer shows.
 * "−48u" says the axis runs backwards from the anchor, so the climb from left to right
 * is rain being counted in as the window reaches further back.
 *
 * One function for both because they are one label in two places: the badge over the
 * map and the point under the cursor always name the same window, and two spellings of
 * it would read as two different things.
 *
 * The minus is U+2212 rather than a hyphen, matching the app's other signed spans.
 */
export function lookbackLabel(hours: number): string {
  return `−${hours}u`;
}

/** A total, in the one decimal the raster actually carries. */
export function formatMm(mm: number): string {
  return `${mm.toFixed(1).replace('.', ',')} mm`;
}

// --- The live source --------------------------------------------------------

/**
 * The layers as the API serves them.
 *
 * Not wired up yet: the endpoints require an authenticated user, the app's only
 * credential is a WorkOS bearer token, and `swiftcast.views_api` currently accepts
 * only Django sessions and DRF tokens. The map runs on the bundled fixtures until
 * that is settled — see DEFERRED.md. This exists now so the contract's own behaviour
 * (the 503, the untouched URLs, the manifest passed through as-is) is written down
 * and tested rather than improvised later.
 */
export function httpSource(options: {
  /** Origin serving `/swiftcast/`, no trailing slash. */
  baseUrl: string;
  /** Called per request, so a refreshed token is picked up without rebuilding. */
  token: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}): CumulativeSource {
  const { baseUrl, token, fetchImpl = fetch } = options;

  const authorized = async (signal?: AbortSignal, extra?: Record<string, string>) => {
    const t = await token();
    if (!t) throw new Error('cumulative: no credential to call the API with');
    return {
      signal,
      headers: { Accept: 'application/json', Authorization: `Bearer ${t}`, ...extra },
    };
  };

  /** A 503 is the documented "not built yet", and carries how long to wait. */
  const guard = (response: Response) => {
    if (response.status === 503) {
      const after = Number(response.headers.get('Retry-After'));
      throw new CumulativeUnavailable(Number.isFinite(after) && after > 0 ? after : 60);
    }
    if (!response.ok) throw new Error(`cumulative: HTTP ${response.status}`);
  };

  return {
    async manifest(signal) {
      const response = await fetchImpl(
        `${baseUrl}/swiftcast/cumulative/`,
        await authorized(signal)
      );
      guard(response);
      return (await response.json()) as CumulativeManifest;
    },

    // Straight from the manifest, anchor stamp and all: building it here is exactly
    // how an app ends up pairing a fresh manifest with the previous hour's pixels.
    overlayUrl(window) {
      return window.png_url;
    },

    async values(window, signal) {
      const response = await fetchImpl(
        window.values_url,
        // Roughly 50-310 KB instead of a megabyte; the HTTP stack decodes it.
        await authorized(signal, { 'Accept-Encoding': 'gzip' })
      );
      guard(response);
      return decodeValues(await response.arrayBuffer());
    },
  };
}

/**
 * Raw `.bin` bytes as the raster the sampler reads.
 *
 * The contract fixes little-endian uint16, and every platform the app runs on is
 * little-endian, so this is a view rather than a conversion — but an odd byte length
 * means the bytes are not the raster they claim to be, and a silently truncated
 * raster would read out plausible numbers from the wrong cells.
 */
export function decodeValues(buffer: ArrayBuffer, dtype: string = EXPECTED_DTYPE): Uint16Array {
  if (dtype !== EXPECTED_DTYPE) {
    throw new Error(`cumulative: unsupported raster dtype "${dtype}"`);
  }
  if (buffer.byteLength % 2 !== 0) {
    throw new Error(`cumulative: raster is ${buffer.byteLength} bytes, not whole uint16s`);
  }
  return new Uint16Array(buffer);
}
