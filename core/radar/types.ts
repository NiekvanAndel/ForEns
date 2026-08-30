/**
 * The radar / nowcast provider contract.
 *
 * ExactCast will supply its own radar and nowcast model. Everything the Radar screen
 * and the Nowcast alert hero need is expressed here, so swapping RainViewer for that
 * model is a new adapter and one line of configuration — no screen changes.
 *
 * Two rules keep it swappable:
 *  - Screens depend on this interface only, never on an adapter.
 *  - Tile URLs are produced by the provider, so a provider is free to use a different
 *    projection, timestamp scheme, or authentication without leaking either upward.
 */

/** One radar image in time. Past and forecast frames are the same shape. */
export interface RadarFrame {
  /** Frame time, epoch milliseconds UTC. */
  timeMs: number;
  /** True for a nowcast frame, false for an observed one. */
  forecast: boolean;
  /** Opaque handle the provider uses to build tile URLs for this frame. */
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
 * One bar of the 0–2h nowcast profile in the alert hero.
 * The design draws them at now, +30, +60 and +120 minutes.
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
  bars: NowcastBar[];
  /** Total expected precipitation over the window, mm. */
  totalMm: number;
  /** Provider confidence, 0–100, shown on the Radar screen. */
  confidence: number;
  /** Minutes until precipitation starts, or null when none is expected. */
  startsInMin: number | null;
  /** Whether any precipitation is expected in the window at all. */
  wet: boolean;
}

export interface RadarProvider {
  /** Stable identifier, shown in the source-breakdown card. */
  readonly id: string;
  /** Human-readable name for the UI, in Dutch. */
  readonly label: string;
  /** Attribution the UI must display, where the provider requires it. */
  readonly attribution?: string;
  /** Maximum sensible zoom for this provider's tiles. */
  readonly maxZoom: number;

  /** Available frames, newest observation last. */
  listFrames(signal?: AbortSignal): Promise<RadarFrames>;

  /** Tile URL for one frame at one tile coordinate. */
  tileUrl(params: TileParams): string;

  /**
   * The 0–2h profile at a point.
   *
   * A provider with a real nowcast model answers directly. A tile-only provider
   * derives it from its forecast frames — which is what the RainViewer adapter does
   * until ExactCast's own model is available.
   */
  nowcastProfile(lat: number, lon: number, signal?: AbortSignal): Promise<NowcastProfile>;
}
