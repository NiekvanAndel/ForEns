/**
 * RainViewer radar adapter.
 *
 * Supplies the radar tiles for the Radar screen and the radar preview card.
 *
 * A note on the nowcast profile: RainViewer publishes tiles, not a point forecast.
 * Reading mm/h at a coordinate from a tile would mean decoding PNG pixels and
 * inverting a colour ramp — lossy, and fragile against any ramp change. So the
 * 0–2h profile comes instead from Open-Meteo's `minutely_15` precipitation, which
 * is a real quarter-hourly point forecast for exactly that window. Tiles show where
 * the rain is; minutely_15 says what falls here. Both are replaced together when
 * ExactCast's own model lands.
 *
 * NOTE: the RainViewer response shape below follows its published API. It could not
 * be verified against the live endpoint from the build environment, so confirm the
 * first run on device.
 */
import { fetchJson } from '../sources/http';
import type {
  NowcastBar, NowcastProfile, RadarFrame, RadarFrames, RadarProvider, TileParams,
} from './types';

const INDEX_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

interface RainViewerFrame {
  time: number;
  path: string;
}

interface RainViewerIndex {
  host: string;
  radar?: {
    past?: RainViewerFrame[];
    /** RainViewer names the forecast frames `nowcast`; `forecast` is accepted too,
     *  because a blank forward half of the timeline is not worth risking on one
     *  key name that could not be verified against the live endpoint. */
    nowcast?: RainViewerFrame[];
    forecast?: RainViewerFrame[];
  };
}

interface MinutelyResponse {
  minutely_15?: { time?: string[]; precipitation?: (number | null)[] };
  utc_offset_seconds?: number;
}

export interface RainViewerOptions {
  /** Tile size; RainViewer serves 256 and 512. */
  tileSize?: 256 | 512;
  /** Colour ramp. 2 is "Universal Blue", which suits the design's rain scale. */
  scheme?: number;
  smooth?: boolean;
  /** Draw snow in its own colour. */
  snow?: boolean;
}

/** The offsets the design's alert hero labels: nu, +30 min, +60 min, +2 uur. */
const BAR_OFFSETS = [0, 30, 60, 120];

/** How far back the quarter-hourly series is asked for, in samples. Two hours, to
 *  match the span of radar frames the loop plays over. */
const PAST_QUARTERS = 8;
/** How far forward: now through +2h inclusive. */
const FORECAST_QUARTERS = 9;

/** Intensity that counts as a full-height bar, mm/h. Above moderate rain the bar
 *  saturates rather than flattening everything below it. */
const FULL_SCALE_MM_H = 7.5;

export class RainViewerProvider implements RadarProvider {
  readonly id = 'rainviewer';
  readonly label = 'RainViewer radar';
  readonly attribution = 'RainViewer';
  /**
   * RainViewer serves its radar mosaic over a limited depth and returns a "zoom
   * level not supported" placeholder tile past it — an image, not an error, so it
   * draws across the map as if it were weather. Ten is inside what it publishes
   * everywhere; deeper views upscale, which for a radar mosaic at 1 km resolution
   * loses nothing that was ever in the data.
   */
  readonly maxZoom = 10;

  /** Retina tiles by default: at 256 MapKit asks for levels far deeper than the
   *  map is showing, which is what fetched unsupported zooms. */
  get tileSize(): number {
    return this.opts.tileSize;
  }

  private index: { data: RainViewerIndex; fetchedMs: number } | null = null;
  private readonly opts: Required<RainViewerOptions>;

  constructor(opts: RainViewerOptions = {}) {
    this.opts = {
      tileSize: opts.tileSize ?? 512,
      scheme: opts.scheme ?? 2,
      smooth: opts.smooth ?? true,
      snow: opts.snow ?? true,
    };
  }

  /** The index lists frames for roughly two hours and updates every ten minutes,
   *  so a short cache avoids refetching it on every pan. */
  private async loadIndex(signal?: AbortSignal): Promise<RainViewerIndex> {
    const fresh = this.index && Date.now() - this.index.fetchedMs < 5 * 60_000;
    if (fresh) return (this.index as { data: RainViewerIndex }).data;
    const data = await fetchJson<RainViewerIndex>(INDEX_URL, 'RainViewer', { signal });
    this.index = { data, fetchedMs: Date.now() };
    return data;
  }

  async listFrames(signal?: AbortSignal): Promise<RadarFrames> {
    const idx = await this.loadIndex(signal);
    const toFrame = (f: { time: number; path: string }, forecast: boolean): RadarFrame => ({
      timeMs: f.time * 1000,
      forecast,
      // The host is stored with the frame so a tile URL needs no further lookup.
      id: `${idx.host}${f.path}`,
    });
    const forecastRaw = idx.radar?.nowcast ?? idx.radar?.forecast ?? [];
    return {
      past: (idx.radar?.past ?? []).map((f) => toFrame(f, false)),
      forecast: forecastRaw.map((f) => toFrame(f, true)),
    };
  }

  tileUrl({ frame, z, x, y, scheme, smooth }: TileParams): string {
    return this.buildUrl(frame, String(z), String(x), String(y), scheme, smooth);
  }

  tileTemplate({ frame, scheme, smooth }: Omit<TileParams, 'z' | 'x' | 'y'>): string {
    return this.buildUrl(frame, '{z}', '{x}', '{y}', scheme, smooth);
  }

  private buildUrl(
    frame: RadarFrame, z: string, x: string, y: string,
    scheme?: number, smooth?: boolean
  ): string {
    const { tileSize, snow } = this.opts;
    const s = scheme ?? this.opts.scheme;
    const sm = (smooth ?? this.opts.smooth) ? 1 : 0;
    return `${frame.id}/${tileSize}/${z}/${x}/${y}/${s}/${sm}_${snow ? 1 : 0}.png`;
  }

  async nowcastProfile(lat: number, lon: number, signal?: AbortSignal): Promise<NowcastProfile> {
    // Forward for the hero's bars, back for the chart under the radar loop, which
    // covers the same two observed hours the frames do.
    const url =
      `${OPEN_METEO}?latitude=${lat}&longitude=${lon}` +
      `&minutely_15=precipitation&past_minutely_15=${PAST_QUARTERS}` +
      `&forecast_minutely_15=${FORECAST_QUARTERS}&timezone=auto`;
    const data = await fetchJson<MinutelyResponse>(url, 'Nowcast', { signal });
    return buildProfile(data);
  }
}

/**
 * Turn a quarter-hourly precipitation series into the hero's bars and the radar
 * page's curve.
 *
 * Values are mm per 15 minutes, so ×4 gives mm/h. Bar heights are percentages of a
 * moderate-rain full scale, floored at 4% so an empty bar still reads as a bar
 * rather than as missing data.
 *
 * Each sample's offset comes from its own timestamp where the response carries one,
 * because the series now starts two hours in the past and counting from index zero
 * would put "now" at the wrong end of it. Without timestamps the old assumption
 * holds — index zero is now — which is what a forward-only response means.
 */
export function buildProfile(data: MinutelyResponse, nowMs: number = Date.now()): NowcastProfile {
  const values = (data.minutely_15?.precipitation ?? []).map((v) => v ?? 0);
  const times = data.minutely_15?.time;
  // Open-Meteo returns local times without an offset when `timezone=auto`, so the
  // response's own offset is what turns one back into an instant.
  const utcOffsetMs = (data.utc_offset_seconds ?? 0) * 1000;
  const offsets =
    times && times.length === values.length
      ? times.map((t) => Math.round((Date.parse(`${t}:00Z`) - utcOffsetMs - nowMs) / 60_000))
      : values.map((_, i) => i * 15);

  const bar = (offsetMin: number, mm: number): NowcastBar => {
    const mmPerHour = mm * 4;
    return {
      offsetMin,
      mmPerHour,
      height: Math.max(4, Math.min(100, (mmPerHour / FULL_SCALE_MM_H) * 100)),
    };
  };

  const series = values.map((mm, i) => bar(offsets[i] ?? i * 15, mm));

  // Everything from the quarter-hour that contains now onwards. A sample is stamped
  // at the start of its quarter, so the current one reads as up to 15 minutes old.
  const forwardFrom = series.findIndex((b) => b.offsetMin > -15);
  const forward = forwardFrom < 0 ? [] : values.slice(forwardFrom, forwardFrom + FORECAST_QUARTERS);

  const mmPerHourAt = (offsetMin: number): number => {
    const i = Math.round(offsetMin / 15);
    return (forward[i] ?? 0) * 4;
  };

  const bars: NowcastBar[] = BAR_OFFSETS.map((offsetMin) => bar(offsetMin, mmPerHourAt(offsetMin) / 4));

  // Total over the forward window: each sample is already mm per quarter-hour.
  const totalMm = forward.reduce((a, b) => a + b, 0);

  const firstWet = forward.findIndex((v) => v > 0.05);
  const startsInMin = firstWet >= 0 ? firstWet * 15 : null;

  // Confidence decays across the window, because a nowcast at +2h is worth less than
  // one at +15min. A provider with a real model reports its own figure instead.
  const confidence = startsInMin == null ? 90 : Math.max(45, 95 - startsInMin / 3);

  return {
    bars,
    series,
    totalMm: Math.round(totalMm * 10) / 10,
    confidence: Math.round(confidence),
    startsInMin,
    wet: totalMm > 0.1,
  };
}
