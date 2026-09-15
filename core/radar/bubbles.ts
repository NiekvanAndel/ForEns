/**
 * Placing the rainfall bubbles on the map without letting them cover each other.
 *
 * Every saved location carries a total while the cumulative layer is up, drawn as a
 * bubble on the map. Locations do not spread themselves out for the reader's
 * convenience — two stations ten kilometres apart are one blob at a country-wide
 * zoom — so something has to decide which bubbles are drawn and which fall back to
 * the plain dot they were before.
 *
 * Two rules do it:
 *
 *  - **Size follows zoom.** Zoomed out, a bubble is a small chip; zoomed in, there is
 *    room for a larger one. Scaling the mark rather than only hiding marks means the
 *    map stays legible at every zoom instead of emptying out at the wide end.
 *  - **The list decides who wins.** Where two bubbles would overlap, the location
 *    higher up the reader's own list is drawn and the other one becomes a dot. Any
 *    other rule — northernmost, wettest, nearest — would reshuffle the map as the
 *    weather changed, and a reader's own ordering is the one thing on screen they
 *    chose themselves.
 *
 * MapLibre positions the markers; this only decides what is drawn, so the projection
 * here is used for collision tests rather than for placement. That is why it can be
 * a plain Web Mercator calculation and why it is worth having as something a test can
 * reach: the alternative is asking the map for every marker's screen point on every
 * frame of a pan.
 */

/** MapLibre's tile size, which is what a zoom level means in pixels. */
const TILE_SIZE = 512;

/** Bubble diameters, in points, at the two ends of the map's zoom range. Below this
 *  a two-digit figure is not readable; above it the bubble starts covering the town
 *  it belongs to. */
const MIN_DIAMETER = 26;
const MAX_DIAMETER = 46;
/** The zooms those diameters belong to; `MIN_ZOOM` in mapStyle, and about as far in
 *  as anyone reads a rainfall field. */
const SMALL_AT_ZOOM = 5;
const LARGE_AT_ZOOM = 11;

/** Clear space between two bubbles, in points. Touching bubbles read as one shape. */
const BUBBLE_GAP = 6;

/** How far outside the viewport a bubble still counts. A marker just off the edge
 *  cannot hide anything on screen, so letting it win a collision would blank a
 *  bubble the reader can see for one they cannot. */
const OFF_SCREEN_MARGIN = 40;

/** The map as it is on screen right now. */
export interface MapView {
  /** [lon, lat] at the centre of the viewport. */
  center: [number, number];
  zoom: number;
  /** Viewport size in points. */
  width: number;
  height: number;
}

/** A location wanting a bubble. */
export interface BubbleCandidate {
  key: string;
  lat: number;
  lon: number;
  /** The total to print, or null where there is nothing to say for this location. */
  mm: number | null;
  /** Position in the reader's saved list; lower wins a collision. */
  priority: number;
  /** The location the map is centred on, drawn as the filled bubble. */
  selected: boolean;
}

export interface PlacedBubble extends BubbleCandidate {
  /** Screen position, points from the top left of the map. */
  x: number;
  y: number;
  /** Diameter at the current zoom. */
  size: number;
}

export interface BubbleLayout {
  /** Drawn as bubbles, in list order. */
  shown: PlacedBubble[];
  /** Crowded out, or with nothing to print: drawn as the plain dot instead. */
  hidden: BubbleCandidate[];
}

/** The diameter a bubble takes at a zoom level, clamped at both ends. */
export function bubbleDiameter(zoom: number): number {
  const span = LARGE_AT_ZOOM - SMALL_AT_ZOOM;
  const f = Math.min(1, Math.max(0, (zoom - SMALL_AT_ZOOM) / span));
  return Math.round(MIN_DIAMETER + f * (MAX_DIAMETER - MIN_DIAMETER));
}

function worldX(lon: number, scale: number): number {
  return ((lon + 180) / 360) * scale;
}

function worldY(lat: number, scale: number): number {
  // Clamped to the Mercator limit: a pole is at infinity, and a saved location near
  // one would otherwise produce a NaN that quietly hides every other bubble.
  const clamped = Math.min(85.05112878, Math.max(-85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
}

/** Where a coordinate falls on screen, in points from the map's top left corner. */
export function screenPointFor(view: MapView, lat: number, lon: number): { x: number; y: number } {
  const scale = TILE_SIZE * Math.pow(2, view.zoom);
  const [centerLon, centerLat] = view.center;
  return {
    x: worldX(lon, scale) - worldX(centerLon, scale) + view.width / 2,
    y: worldY(lat, scale) - worldY(centerLat, scale) + view.height / 2,
  };
}

/**
 * Which bubbles are drawn, and where.
 *
 * Candidates are taken in list order, so the first one always wins and each later one
 * is drawn only where it clears everything already placed. A location with nothing to
 * print never takes a slot from one that has something to say.
 */
export function layoutBubbles(
  candidates: readonly BubbleCandidate[],
  view: MapView
): BubbleLayout {
  const size = bubbleDiameter(view.zoom);
  const shown: PlacedBubble[] = [];
  const hidden: BubbleCandidate[] = [];

  for (const candidate of [...candidates].sort((a, b) => a.priority - b.priority)) {
    if (candidate.mm == null) {
      hidden.push(candidate);
      continue;
    }

    const at = screenPointFor(view, candidate.lat, candidate.lon);
    const off =
      at.x < -OFF_SCREEN_MARGIN ||
      at.y < -OFF_SCREEN_MARGIN ||
      at.x > view.width + OFF_SCREEN_MARGIN ||
      at.y > view.height + OFF_SCREEN_MARGIN;
    if (off) {
      hidden.push(candidate);
      continue;
    }

    const clash = shown.some((placed) => {
      const dx = placed.x - at.x;
      const dy = placed.y - at.y;
      return Math.hypot(dx, dy) < size + BUBBLE_GAP;
    });
    if (clash) {
      hidden.push(candidate);
      continue;
    }

    shown.push({ ...candidate, ...at, size });
  }

  return { shown, hidden };
}

/**
 * A total as the bubble prints it.
 *
 * Whole millimetres up to ten, because a bubble this size fits two digits and a
 * tenth of a millimetre is not what anyone reads off a map; a tenth below that,
 * where the difference between 0.4 and 0.8 is the difference between a dry morning
 * and a wet one.
 */
export function bubbleText(mm: number): string {
  if (mm >= 10) return String(Math.round(mm));
  if (mm >= 1) return mm.toFixed(1).replace('.0', '').replace('.', ',');
  return mm.toFixed(1).replace('.', ',');
}
