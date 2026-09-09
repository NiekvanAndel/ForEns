/**
 * The radar / nowcast provider contract.
 *
 * ExactCast supplies its own radar and nowcast model — the DGMR run published to
 * `nowcast.agroexact.com`. Everything the Radar screen and the Nowcast panel need is
 * expressed here, so a different source is a new adapter and one line of
 * configuration, not a screen change.
 *
 * Two rules keep it swappable:
 *  - Screens depend on this interface only, never on an adapter.
 *  - Frame imagery is produced by the provider, so a provider is free to use a
 *    different projection, timestamp scheme, or authentication without leaking
 *    either upward.
 *
 * A provider delivers its imagery one of two ways, and the map branches on `kind`:
 * `tiles` is the usual {z}/{x}/{y} pyramid, `overlay` a single georeferenced image
 * per frame. DGMR publishes one PNG per frame over fixed bounds rather than a tile
 * pyramid, which is why the second shape exists at all.
 */

/** One radar image in time. Past and forecast frames are the same shape. */
export interface RadarFrame {
  /** Frame time, epoch milliseconds UTC. */
  timeMs: number;
  /** True for a nowcast frame, false for an observed one. */
  forecast: boolean;
  /** Opaque handle the provider uses to build this frame's imagery URLs. */
  id: string;
}

export interface RadarFrames {
  past: RadarFrame[];
  forecast: RadarFrame[];
}

export interface TileParams {
  frame: RadarFrame;
  z: number;
  x: number;
  y: number;
  /** Colour ramp index, where the provider supports more than one. */
  scheme?: number;
  /** Whether the provider should smooth the tile. */
  smooth?: boolean;
}

/**
 * One bar of the nowcast profile.
 *
 * Sampled at now, +30, +60 and +90 minutes: +90 is where the DGMR run ends, and a
 * bar past the model's own horizon would be an invention rather than a forecast.
 */
export interface NowcastBar {
  /** Minutes from now. */
  offsetMin: number;
  /** Expected intensity, mm/h. */
  mmPerHour: number;
  /** Bar height as a percentage, which is what the hero actually renders. */
  height: number;
}

export interface NowcastProfile {
  /** The four sampled bars: now, +30, +60, +90 minutes. */
  bars: NowcastBar[];
  /**
   * The full five-minutely series, including the observed frames already past.
   *
   * The radar chart draws this rather than `bars`, so the curve covers exactly the
   * window the map has pictures for — one sample per radar frame, on both sides of
   * now. Four bars are the right shape for a summary; the chart wants every sample
   * it can get.
   */
  series: NowcastBar[];
  /** Total expected precipitation over the forward window, mm. */
  totalMm: number;
  /** Provider confidence, 0–100, shown on the Radar screen. */
  confidence: number;
  /** Minutes until precipitation starts, or null when none is expected. */
  startsInMin: number | null;
  /** Whether any precipitation is expected in the window at all. */
  wet: boolean;
}

/** A lat/lon rectangle, as a georeferenced overlay is placed on the map. */
export interface GeoBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** One frame drawn as a single image pinned to a rectangle on the map. */
export interface RadarOverlay {
  url: string;
  bounds: GeoBounds;
}

/** What every provider answers, however it draws its frames. */
interface RadarProviderBase {
  /** Stable identifier, shown in the source-breakdown card. */
  readonly id: string;
  /** Human-readable name for the UI, in Dutch. */
  readonly label: string;
  /** Attribution the UI must display, where the provider requires it. */
  readonly attribution?: string;
  /** Maximum sensible zoom for this provider's imagery. Past it the map upscales
   *  rather than asking for detail the provider does not have. */
  readonly maxZoom: number;

  /** Available frames, newest observation last. */
  listFrames(signal?: AbortSignal): Promise<RadarFrames>;

  /**
   * Whether this provider has anything to say about a point.
   *
   * A regional radar covers a rectangle, not the world, and a reader with a saved
   * location outside it is owed a sentence rather than an empty chart. Screens ask
   * before they draw; a global provider simply answers true.
   */
  coversPoint(lat: number, lon: number): boolean;

  /**
   * The nowcast profile at a point.
   *
   * A provider with a real nowcast model answers from it directly. Callers must
   * check `coversPoint` first — outside the covered area there is no answer to give.
   */
  nowcastProfile(lat: number, lon: number, signal?: AbortSignal): Promise<NowcastProfile>;
}

/** A provider serving a {z}/{x}/{y} tile pyramid. */
export interface TileRadarProvider extends RadarProviderBase {
  readonly kind: 'tiles';

  /**
   * The pixel size of one tile, 256 or 512.
   *
   * The map needs it as well as the URL. MapKit picks the zoom level to fetch from
   * the tile size it is told: at 256 on a 3× screen it asks for levels around two
   * deeper than the map is showing, which is how a country-wide view ended up
   * requesting tiles past a provider's maximum and getting a placeholder back.
   */
  readonly tileSize: number;

  /** Tile URL for one frame at one tile coordinate. */
  tileUrl(params: TileParams): string;

  /**
   * The same URL as a `{z}/{x}/{y}` template.
   *
   * Map components take a template and substitute coordinates themselves, so a
   * provider must be able to express one — string-replacing a concrete URL would
   * break the moment a provider put digits elsewhere in its path.
   */
  tileTemplate(params: Omit<TileParams, 'z' | 'x' | 'y'>): string;
}

/** A provider serving one georeferenced image per frame. */
export interface OverlayRadarProvider extends RadarProviderBase {
  readonly kind: 'overlay';

  /**
   * The image for one frame and where it belongs on the map.
   *
   * Null until the provider knows its own bounds, which it learns from the same
   * manifest the frames come from — so in practice never null for a frame the
   * caller was given by `listFrames`.
   */
  frameOverlay(frame: RadarFrame): RadarOverlay | null;

  /** Every frame's image URL, for warming the image cache before playback. */
  frameImageUrls(frames: readonly RadarFrame[]): string[];
}

export type RadarProvider = TileRadarProvider | OverlayRadarProvider;
