/**
 * Shared decisions for both maps — the preview on 'Nu' and the full radar screen.
 *
 * ## Why MapLibre and not Apple Maps
 *
 * The radar loop is an animation, and Apple Maps could not play one. react-native-maps
 * draws a georeferenced image through AIRMapOverlay, whose image load ends in an
 * `update` that does `[_map removeOverlay:self]; [_map addOverlay:self];`
 * unconditionally. Two things follow from that, and both were visible in the app:
 * a frame unmounted while its image was still loading re-added *itself* afterwards,
 * so stepping the loop stacked every frame it had ever shown; and once a single
 * overlay was reused instead, the remove/add on each step made MapKit re-rasterise
 * the layer, which blanked the map for a beat. Neither has a prop to turn it off,
 * and `Overlay`'s `opacity` — the way you would normally cross-fade frames — is
 * documented as Google Maps only and is never read by the iOS renderer.
 *
 * MapLibre has the piece that was missing: real per-layer opacity. Every frame is
 * mounted once as its own raster layer and a step only flips which one is opaque,
 * so nothing is added, removed, refetched or re-rasterised while the loop plays.
 * That is how the AgroExact RN client animates the same imagery.
 *
 * ## Why the basemap is OpenFreeMap
 *
 * Leaving Apple Maps means bringing a basemap. OpenFreeMap serves OpenStreetMap
 * vector tiles with no API key and no quota, which keeps the app free of a metered
 * third-party account for what is only a backdrop to the radar.
 *
 * Bright in light, Fiord in dark. NOTE: `tiles.openfreemap.org` is unreachable from
 * the build environment (the network policy blocks it), so neither URL below could
 * be requested to confirm its exact slug — nor could the style JSON that
 * `localiseStyle` below rewrites.
 *
 * ## Why the map is clamped at both ends
 *
 * The radar imagery is one image per frame at about a kilometre per pixel, so past
 * the provider's own maximum the map is only scaling it up, and far enough in it is
 * mush. Out at the whole-world levels the basemap has nothing useful to say about a
 * shower over Brabant either. So the camera is held inside a band and every starting
 * view is chosen to sit within it.
 */
import type { LayerSpecification, StyleSpecification } from '@maplibre/maplibre-react-native';
import type { Appearance, Palette } from '../../theme';

/** The basemap, per appearance.
 *
 *  If either ever 404s the map comes up empty, and these two URLs are the thing to
 *  change; CARTO's `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`
 *  is the drop-in for dark. */
const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/bright';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/fiord';

export function mapStyleFor(appearance: Appearance): string {
  return appearance === 'dark' ? STYLE_DARK : STYLE_LIGHT;
}

// ── Labels in the reader's language ─────────────────────────────────────────────

/**
 * Rewrite a basemap's place labels to prefer one language.
 *
 * MapLibre Native has no "set the map's language" call — `setLanguage` is a thing in
 * the web build and in Mapbox's SDK, not here. The labels live in the style, so the
 * only way to change them is to change the style: fetch it, rewrite the `text-field`
 * of the layers that draw names, and hand MapLibre the result instead of the URL.
 *
 * ## What it asks for, and in what order
 *
 * OpenStreetMap tags a place with `name` in its own local language, and with
 * `name:<lang>` for whatever else has been translated. The OpenMapTiles schema
 * OpenFreeMap uses carries `name`, `name:latin`, `name_int`, and — depending on how
 * the tiles were generated — a set of `name:<lang>` fields.
 *
 * So the chain is: the reader's language, then the local name, then the Latin
 * transliteration. The middle step is the important one and the reason this is worth
 * doing at all: the stock style prefers an international field, which is why a Dutch
 * app labelled the Belgian capital BRUSSELS. Falling back to `name` gives Brussel,
 * Köln and Liège — the names on the road signs — even where no translation exists.
 *
 * ## Which layers are touched
 *
 * Only symbol layers whose `text-field` already mentions a name. A basemap also
 * labels motorway shields with `ref`, contours with `ele` and buildings with a house
 * number, and rewriting those to a name would blank them. The test is deliberately a
 * blunt one — does this expression mention `name` at all — because the alternative is
 * enumerating every layer id of a style this app does not own and cannot see change.
 */
export function localiseStyle(style: StyleSpecification, lang: string): StyleSpecification {
  if (!Array.isArray(style?.layers)) return style;
  return {
    ...style,
    layers: style.layers.map((layer) => localiseLayer(layer, lang)),
  };
}

function localiseLayer(layer: LayerSpecification, lang: string): LayerSpecification {
  if (layer.type !== 'symbol') return layer;
  const field = layer.layout?.['text-field'];
  if (field === undefined || !mentionsName(field)) return layer;

  return {
    ...layer,
    layout: {
      ...layer.layout,
      // `name_<lang>` as well as `name:<lang>`: OpenMapTiles carries English and
      // German under the underscored spelling and everything else under the colon,
      // and a chain that asks for both costs nothing where one is absent.
      'text-field': [
        'coalesce',
        ['get', `name:${lang}`],
        ['get', `name_${lang}`],
        ['get', 'name'],
        ['get', 'name:latin'],
        ['get', 'name_int'],
        '',
      ],
    },
  } as LayerSpecification;
}

/**
 * How deep into the basemap the weather is buried.
 *
 * - `labels` — under the names only. Everything else the basemap draws, roads included,
 *   is on top of the weather.
 * - `features` — under the water and the roads too, so a field covers nothing but the
 *   landcover it is over.
 * - `geography` — water, coastline, boundaries and names above; roads and buildings
 *   below. The geographic skeleton stays legible and the road network stops competing
 *   with the field for the same pixels.
 * - `coast` — only the coastline, the boundaries and the names above. The water areas
 *   themselves go under the weather, so a field runs across the IJsselmeer and the
 *   rivers as one surface, with the shoreline drawn back on top as a line.
 *
 * `coast` is the current choice (2026-09-15, at the client's direction). Flip this one
 * constant to compare; nothing else in the app has an opinion.
 *
 * ## Why this reorders the style rather than picking an insertion point
 *
 * A style draws in array order and `beforeId` is a single position, so what a layer ends
 * up above or below follows entirely from where the raster lands. In the OpenMapTiles
 * order the roads sit *between* the water and the boundaries — water, roads, boundaries,
 * names — and no single position can put water and boundaries above while leaving roads
 * below.
 *
 * So the mode is expressed as a question asked of each layer ("does this belong over the
 * weather?"), the layers are partitioned on the answer, and the raster is inserted at the
 * seam. The app already rewrites this document to translate its labels, so reordering it
 * is the same kind of change rather than a new liberty.
 */
export const WEATHER_UNDER: 'labels' | 'features' | 'geography' | 'coast' = 'coast';

// ── Which layers belong over the weather ────────────────────────────────────────

/**
 * Source layers the OpenMapTiles schema files things under. Checked before layer ids,
 * because a schema is a contract and a layer id is a style author's habit.
 */
const SOURCE_LAYERS = {
  built: ['transportation', 'transportation_name', 'building', 'aeroway'],
  water: ['water', 'waterway', 'ocean'],
  boundary: ['boundary'],
  ground: ['landcover', 'landuse', 'park', 'globallandcover'],
};

const BUILT_ID =
  /road|highway|motorway|trunk|street|bridge|tunnel|rail|transit|aeroway|building|ferry/i;
const WATER_ID = /water|ocean|river|lake|sea\b/i;
const BOUNDARY_ID = /boundary|border|admin/i;

function sourceLayerOf(layer: LayerSpecification): string | undefined {
  return (layer as { 'source-layer'?: string })['source-layer'];
}

/** Whether a layer draws something built rather than something geographic. */
export function isBuiltLayer(layer: LayerSpecification): boolean {
  const source = sourceLayerOf(layer);
  if (source) return SOURCE_LAYERS.built.includes(source);
  return BUILT_ID.test(layer.id);
}

/** Whether a layer draws water — the areas, not their names. */
export function isWaterLayer(layer: LayerSpecification): boolean {
  if (layer.type === 'symbol') return false;
  const source = sourceLayerOf(layer);
  if (source) return SOURCE_LAYERS.water.includes(source);
  return WATER_ID.test(layer.id);
}

/** Whether a layer draws a national or regional border. */
export function isBoundaryLayer(layer: LayerSpecification): boolean {
  if (layer.type === 'symbol') return false;
  const source = sourceLayerOf(layer);
  if (source) return SOURCE_LAYERS.boundary.includes(source);
  return BOUNDARY_ID.test(layer.id);
}

/** Whether a layer draws a name — the same blunt test `localiseStyle` uses. */
export function isLabelLayer(layer: LayerSpecification): boolean {
  return layer.type === 'symbol' && mentionsName(layer.layout?.['text-field']);
}

/** Whether a layer is the ground itself: the backdrop, the landcover, the parks. */
export function isGroundLayer(layer: LayerSpecification): boolean {
  if (layer.type === 'background') return true;
  const source = sourceLayerOf(layer);
  return layer.type === 'fill' && !!source && SOURCE_LAYERS.ground.includes(source);
}

/** The question each mode asks of a layer: does this belong over the weather? */
export function drawsOverWeather(layer: LayerSpecification): boolean {
  switch (WEATHER_UNDER) {
    case 'labels':
      return isLabelLayer(layer);
    case 'features':
      return !isGroundLayer(layer);
    case 'geography':
      return !isGroundLayer(layer) && !isBuiltLayer(layer);
    case 'coast':
      // `!isBuiltLayer` is what keeps the road *names* down with the road lines. A road
      // hidden under a temperature field whose label still floats above it reads as a
      // bug rather than a choice, and a road name is a label by every other test.
      return (isBoundaryLayer(layer) || isLabelLayer(layer)) && !isBuiltLayer(layer);
  }
}

// ── Putting the weather into the style ──────────────────────────────────────────

/** The id of the coastline this module draws when the water areas go under the weather. */
export const COASTLINE_LAYER_ID = 'weather-coastline';

/** How the drawn-back coastline looks where the basemap gives nothing to copy. */
const COASTLINE_FALLBACK = '#7aa6c2';
const COASTLINE_WIDTH = 0.9;

/**
 * A coastline, for a map whose water has gone under the weather.
 *
 * OpenMapTiles has no coastline layer: the coast is the edge of the water polygon, so
 * sinking the water takes the shoreline with it and the country loses its shape. A line
 * layer over the same source draws that polygon's outline and gives it back — the
 * shoreline, the IJsselmeer's edge and the wider rivers, over the field rather than
 * under it.
 *
 * Its colour is lifted from the water fill it is tracing, so the line belongs to the
 * basemap it came from and follows the appearance without being told which one is on. A
 * fill painted with an expression gives nothing to copy, and then a neutral stands in.
 */
export function coastlineLayer(style: StyleSpecification): LayerSpecification | null {
  const water = style.layers?.find(
    (layer) => layer.type === 'fill' && isWaterLayer(layer)
  ) as (LayerSpecification & { source?: string; paint?: Record<string, unknown> }) | undefined;
  if (!water?.source) return null;

  const fill = water.paint?.['fill-color'];
  return {
    id: COASTLINE_LAYER_ID,
    type: 'line',
    source: water.source,
    'source-layer': sourceLayerOf(water),
    paint: {
      'line-color': typeof fill === 'string' ? fill : COASTLINE_FALLBACK,
      'line-width': COASTLINE_WIDTH,
    },
  } as unknown as LayerSpecification;
}

/**
 * The style as the map should draw it: everything that belongs under the weather first,
 * everything that belongs over it after, each group in its original order.
 *
 * Partitioning rather than moving individual layers is what keeps every group stacked
 * the way its author drew it — road casings under road fills, motorways over tracks.
 * What changes is only where the seam falls.
 */
export function orderForWeather(style: StyleSpecification): StyleSpecification {
  if (!Array.isArray(style?.layers)) return style;

  const below: LayerSpecification[] = [];
  const above: LayerSpecification[] = [];
  for (const layer of style.layers) (drawsOverWeather(layer) ? above : below).push(layer);
  if (!above.length) return style;

  // With the water underneath, the shoreline has to be drawn back on, and it goes at the
  // bottom of the group above — under the boundaries and the names, as it was.
  const coast = WEATHER_UNDER === 'coast' ? coastlineLayer(style) : null;
  return { ...style, layers: [...below, ...(coast ? [coast] : []), ...above] };
}

/**
 * The style layer the app's own raster layers should be drawn beneath.
 *
 * The first layer of the group that belongs over the weather, which after
 * `orderForWeather` is exactly the seam. Callers pass it straight to `beforeId`, where
 * undefined means "on top" — the behaviour before any of this existed, and the right
 * fallback for a style that is still a URL or that failed to load.
 */
export function weatherBeforeLayerId(style: StyleSpecification | string | undefined) {
  if (!style || typeof style === 'string' || !Array.isArray(style.layers)) return undefined;
  if (WEATHER_UNDER === 'coast') {
    const coast = style.layers.find((layer) => layer.id === COASTLINE_LAYER_ID);
    if (coast) return coast.id;
  }
  return style.layers.find(drawsOverWeather)?.id;
}

/** Whether an expression or token string draws a name at all. See above. */
function mentionsName(field: unknown): boolean {
  return JSON.stringify(field)?.includes('name') ?? false;
}

/** How far out the map will go. Below this a radar frame covers a continent. */
export const MIN_ZOOM = 4;

/** How far in. Two levels past the provider's own maximum is as far as an upscaled
 *  radar image stays readable. */
export const maxZoomFor = (providerMaxZoom: number) => providerMaxZoom + 2;

/** The zoom a radar map opens on: the country and the weather heading for it, and
 *  the same framing the map had before the move to MapLibre. */
export const START_ZOOM = 7;

/**
 * The zoom the *full-screen* map opens on: one level further out (2026-09-15, at the
 * client's direction).
 *
 * A level is a factor of two, so this goes from about 165 km across a phone to about
 * 330 km — the Netherlands whole, with Belgium and a slice of Germany around it. That
 * is the footprint of both products the page draws: the nowcast run covers NL, BE and
 * western Germany, and the Detailcharts fields are published over NL+BE. Opening inside
 * your own data and having to pinch out to find its edge is the wrong first impression
 * of a map that has a country's worth to show.
 *
 * The card on the home screen keeps `START_ZOOM`: it is a small square meant to answer
 * "is it raining here", and a country in a thumbnail answers nothing.
 */
export const FULL_MAP_START_ZOOM = 6;

/** The band the zoom buttons work within, matching MIN_ZOOM and maxZoomFor. */
export const ZOOM_STEP = 1;

export interface MapChrome {
  /** Background for anything floating on the map. */
  bg: string;
  /** Text and icons on that background. */
  ink: string;
  /** The "you are here" pin. */
  here: string;
  dark: boolean;
}

/** Chrome on a map takes its colours from the map's own appearance, not from the
 *  page underneath it. */
export function mapChrome(palette: Palette, appearance: Appearance): MapChrome {
  const dark = appearance === 'dark';
  return {
    dark,
    bg: dark ? 'rgba(20,32,52,.90)' : 'rgba(255,255,255,.94)',
    ink: dark ? '#F2F7FC' : '#0C2547',
    here: dark ? palette.skySoft : '#0C2547',
  };
}
