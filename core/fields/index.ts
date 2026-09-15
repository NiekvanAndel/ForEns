/**
 * Detailcharts field layers — temperature, humidity and wind as maps rather than
 * numbers, on a ten-minute loop over the last few hours.
 *
 * The regression behind them is a different thing from the radar entirely: station
 * observations of several qualities blended into a posterior field plus its own
 * uncertainty, over the Netherlands and Belgium. What arrives here, though, is shaped
 * exactly like the cumulative radar layer — a manifest, an overlay per frame, and a
 * value raster to read a number out of — because that is a shape this app already knows
 * how to draw, and reusing it made the app side wiring instead of architecture.
 *
 * The contract is `docs/app_layer_plan.md` in the Detailcharts repo. Four things in it
 * are load-bearing and are honoured here rather than in the screens:
 *
 *  - **The manifest owns every URL**, cache stamp and all. Nothing here builds one.
 *  - **The manifest owns the legend and the raster geometry.** Both can change
 *    server-side without a release, so the ramp is read from `legend` and every sampled
 *    read-out is placed with `raster.rows`/`raster.cols` — never with constants.
 *  - **The overlays are already faded.** Their alpha is the posterior's uncertainty:
 *    solid where the field is anchored by stations, gone where the regression is only
 *    extrapolating. So the map draws them at full opacity and lets the image decide
 *    where it stops. `manifest.fade` says what the thresholds were, for a UI that wants
 *    to explain itself.
 *  - **`source` says whether this is weather.** "measured" is the pipeline's own
 *    output; "synthetic" means frames were derived to build against, and the UI has to
 *    be able to say so out loud.
 *
 * ## The scale is fixed, and that is the point
 *
 * Every frame is drawn on the same range, so a colour means the same temperature at
 * 04:00 as at 16:00 and moving colour means moving weather. Temperature uses the app's
 * own scale — the stops in `core/model/temperatureColor.ts`, exported into the manifest
 * by the pipeline — so the pixel under a location and the figure printed on it cannot
 * disagree.
 */
import type { GeoBounds } from '../radar/types';

/** The variables published as layers. One folder each, one manifest each. */
export type FieldVariable = 'temperature' | 'humidity' | 'wind';

export const FIELD_VARIABLES: FieldVariable[] = ['temperature', 'humidity', 'wind'];

/** The value raster, as the manifest describes it. */
export interface FieldRaster {
  rows: number;
  cols: number;
  dtype: string;
  byte_order: string;
  /** `raw * scale + offset` is the value in `unit`. */
  scale: number;
  offset: number;
  /** The raw value standing for "nothing here" — sea, or outside the domain. */
  nodata: number;
  unit: string;
}

/**
 * The colour ramp, already resolved.
 *
 * `values[i]` is drawn in `colors[i]` and anything between two stops is interpolated
 * through RGB, which is how a ramp that is logarithmic upstream arrives as something a
 * client can read straight off. Outside the range the end colours hold.
 */
export interface FieldLegend {
  vmin: number;
  vmax: number;
  values: number[];
  colors: string[];
}

/** What the overlay's alpha channel means, in the variable's own unit. */
export interface FieldFade {
  source: string;
  opaque_below: number;
  transparent_above: number;
  unit: string;
}

/** One published timestamp. */
export interface FieldFrame {
  /** UTC ISO. */
  time: string;
  png_url: string;
  values_url: string;
  /** Median posterior uncertainty over the drawn area, in the variable's unit. */
  uncertainty_median: number | null;
  /** Fraction of the box that is drawn at all. */
  coverage: number;
  /** Present and true where this frame was derived rather than observed. */
  synthetic?: boolean;
}

export interface FieldManifest {
  variable: FieldVariable;
  label: string;
  unit: string;
  /** The newest frame, UTC ISO. Not "now": a run is minutes old before a phone sees it. */
  anchor: string;
  generated_at: string;
  cadence_minutes: number;
  /** "measured" for the pipeline's own output, "synthetic" for derived scaffolding. */
  source: string;
  projection: string;
  /** [left, bottom, right, top] in EPSG:3857 — the same rectangle as `bounds_wgs84`. */
  bounds_3857: [number, number, number, number];
  bounds_wgs84: GeoBounds;
  /** The overlay PNGs' pixel dimensions. */
  image: { rows: number; cols: number };
  raster: FieldRaster;
  legend: FieldLegend;
  fade: FieldFade;
  /** Leave-one-out cross-validation against the first-party network, from the run. */
  xval: Record<string, number>;
  /** Oldest first. */
  frames: FieldFrame[];
}

/**
 * The layers are not built yet.
 *
 * As with the cumulative radar, a backend that has not produced this hour's frames
 * answers 503 with `Retry-After`. That is a state to render — "not available yet" —
 * rather than a failure, so it has its own class.
 */
export class FieldsUnavailable extends Error {
  constructor(readonly retryAfterSec: number) {
    super(`Field layers not built yet; retry in ${retryAfterSec}s`);
    this.name = 'FieldsUnavailable';
  }
}

/**
 * Where the layers come from.
 *
 * Two implementations: the bundled fixture in `./fixture`, and `httpSource` below.
 * Screens never touch either directly — they take whichever they are given — so moving
 * from the fixture to the live endpoints changes one line of wiring and nothing in the
 * UI.
 */
export interface FieldSource {
  /** One variable's manifest. Throws `FieldsUnavailable` while nothing is built. */
  manifest(variable: FieldVariable, signal?: AbortSignal): Promise<FieldManifest>;
  /** What the map draws for a frame — whatever the map library can load. */
  overlayUrl(manifest: FieldManifest, frame: FieldFrame): string;
  /** The frame's value raster, decoded to the manifest's raw uint16. */
  values(manifest: FieldManifest, frame: FieldFrame, signal?: AbortSignal): Promise<Uint16Array>;
}

// --- Geometry ---------------------------------------------------------------

const MERCATOR_RADIUS = 6378137;
const RAD = Math.PI / 180;

function mercatorX(lon: number): number {
  return MERCATOR_RADIUS * lon * RAD;
}

function mercatorY(lat: number): number {
  return MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
}

/** The rectangle the overlay is draped over. A lat/lon box is an exact rectangle in
 *  Web Mercator, so this is the same shape as `bounds_3857` and either will do. */
export function overlayBounds(manifest: FieldManifest): GeoBounds {
  return { ...manifest.bounds_wgs84 };
}

/**
 * The raster cell a coordinate falls in, or null outside the published box.
 *
 * Linear in Web Mercator, not in degrees: the raster is an EPSG:3857 image, and walking
 * its rows linearly in latitude would drift by kilometres across four degrees of it.
 * The exporter knows this and publishes bounds that are the outer edges of the first and
 * last pixel, so the fraction maps straight onto the cell index.
 */
export function pixelFor(
  manifest: FieldManifest,
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
 * The value at a coordinate, or null where the layer has nothing to say.
 *
 * Null covers three different silences that all come to the same thing for a reader:
 * outside the published box, outside the land the pipeline masked, and a cell the
 * regression would only have guessed at. `values` is row-major on exactly the raster the
 * manifest describes, which is why the dimensions come from the manifest rather than
 * being assumed — a fixture build and a production build need not agree about raster
 * size for this to be right.
 */
export function sampleField(
  manifest: FieldManifest,
  values: Uint16Array,
  lat: number,
  lon: number
): number | null {
  const at = pixelFor(manifest, lat, lon);
  if (!at) return null;
  const { cols, scale, offset, nodata } = manifest.raster;
  const index = at.row * cols + at.col;
  if (index < 0 || index >= values.length) return null;
  const raw = values[index]!;
  if (raw === nodata) return null;
  return raw * scale + offset;
}

// --- The ramp ---------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex(rgb: readonly number[]): string {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The colour the map draws a value in, from the manifest's own ramp.
 *
 * Interpolated through RGB between the two stops around the value and held at the ends,
 * which is both what the exporter did to make the pixels and what
 * `core/model/temperatureColor.ts` does to colour a printed figure. All three therefore
 * agree — a bubble's fill is the colour of the pixel under it, and of the number in the
 * hourly list.
 *
 * Null for a value that is not a number, so a location with no reading can print a dash
 * rather than a colour standing for nothing.
 */
export function legendColorFor(legend: FieldLegend, value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const { values, colors } = legend;
  if (!values.length || values.length !== colors.length) return null;
  if (value <= values[0]!) return colors[0]!;
  if (value >= values[values.length - 1]!) return colors[colors.length - 1]!;

  for (let i = 0; i < values.length - 1; i++) {
    const a = values[i]!;
    const b = values[i + 1]!;
    if (value >= a && value <= b) {
      const t = (value - a) / (b - a);
      const from = hexToRgb(colors[i]!);
      const to = hexToRgb(colors[i + 1]!);
      return rgbToHex(from.map((v, j) => v + ((to[j] ?? v) - v) * t));
    }
  }
  return colors[colors.length - 1]!;
}

// --- Reading the manifest ---------------------------------------------------

/** Oldest first, which is the order the slider runs in and the loop plays. */
export function orderedFrames(manifest: FieldManifest): FieldFrame[] {
  return [...manifest.frames].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}

/** Whether any frame on show was derived rather than observed. */
export function isSynthetic(manifest: FieldManifest): boolean {
  return manifest.source === 'synthetic' || manifest.frames.some((f) => f.synthetic);
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** A frame's time as the reader's own clock reads it — the label under the scrubber. */
export function frameClock(frame: FieldFrame): string {
  const d = new Date(frame.time);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** How far back the loop reaches, in whole minutes, from its own cadence and length. */
export function loopMinutes(manifest: FieldManifest): number {
  return Math.max(0, (manifest.frames.length - 1) * manifest.cadence_minutes);
}

/**
 * The unit as it is printed beside a figure, from the manifest's CF-style unit.
 *
 * The manifest speaks CF because the pipeline writes NetCDF; a reader does not. An
 * unrecognised unit is passed through rather than blanked: a wrong-looking unit beside
 * a number is a bug report, a missing one is a mystery.
 */
export function unitLabel(unit: string): string {
  if (unit === 'degC') return '\u00b0C';
  if (unit === 'percent') return '%';
  if (unit === 'm s-1') return 'm/s';
  return unit;
}

/**
 * Readable ink on a fill taken from the ramp.
 *
 * Rec. 601 luma, which is the cheap approximation that gets this right across a scale
 * running from #244E8C through #7FD9C9 to #7A1414: the mint and the yellow need dark
 * ink, both ends need light. Used by the bubbles, whose fill is the value's own colour.
 */
export function inkOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luma = (0.299 * (r ?? 0) + 0.587 * (g ?? 0) + 0.114 * (b ?? 0)) / 255;
  return luma > 0.6 ? '#0C2547' : '#FFFFFF';
}

/**
 * How a value should be printed: the unit's own precision, not the raster's.
 *
 * The rasters carry hundredths because that is what fits in a uint16, not because a
 * reader wants them. A temperature is a whole degree in this app, humidity a whole
 * percent, wind one decimal.
 */
export function formatFieldValue(variable: FieldVariable, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '–';
  if (variable === 'wind') return value.toFixed(1);
  return String(Math.round(value));
}

// --- The live source --------------------------------------------------------

/**
 * The layers over HTTP.
 *
 * Unused while the fixture is in place and deliberately written anyway: it is what
 * proves the fixture is standing in for something, and what the screens are typed
 * against. The base URL and whether it needs a credential are the one thing still
 * undecided about hosting, so both are injected rather than assumed.
 */
export function httpSource(options: {
  /** Origin serving `<base>/<variable>/manifest.json`, no trailing slash. */
  baseUrl: string;
  /** Called per request, so a refreshed token is picked up without rebuilding. Return
   *  null where the layers are served without one. */
  token?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}): FieldSource {
  const { baseUrl, token, fetchImpl = fetch } = options;

  const request = async (url: string, signal?: AbortSignal) => {
    const bearer = token ? await token() : null;
    const response = await fetchImpl(url, {
      signal,
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
    });
    if (response.status === 503) {
      const after = Number(response.headers.get('Retry-After'));
      throw new FieldsUnavailable(Number.isFinite(after) && after > 0 ? after : 60);
    }
    if (!response.ok) throw new Error(`fields: HTTP ${response.status}`);
    return response;
  };

  /** A frame's URL as the manifest gave it, resolved against the variable's folder when
   *  it is relative. Nothing is *built* here: the stamp the manifest put on it is what
   *  keeps a new run out of the previous one's HTTP cache. */
  const resolve = (manifest: FieldManifest, url: string) =>
    /^https?:/.test(url) ? url : `${baseUrl}/${manifest.variable}/${url.replace(/^\.\//, '')}`;

  return {
    async manifest(variable, signal) {
      const response = await request(`${baseUrl}/${variable}/manifest.json`, signal);
      return (await response.json()) as FieldManifest;
    },

    overlayUrl(manifest, frame) {
      return resolve(manifest, frame.png_url);
    },

    async values(manifest, frame, signal) {
      const response = await request(resolve(manifest, frame.values_url), signal);
      const bytes = await response.arrayBuffer();
      const { rows, cols } = manifest.raster;
      if (bytes.byteLength !== rows * cols * 2) {
        // A raster of the wrong size is a changed product, not a bad pixel: sampling it
        // would place every reading somewhere other than where it was measured.
        throw new Error(
          `fields: raster is ${bytes.byteLength} bytes, manifest says ${rows * cols * 2}`
        );
      }
      return new Uint16Array(bytes);
    },
  };
}
