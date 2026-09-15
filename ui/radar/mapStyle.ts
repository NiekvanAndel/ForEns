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
 * - `labels` — under the names only. Everything the basemap draws, roads included, is
 *   on top of the weather.
 * - `features` — under the water and the roads too, so a field covers nothing but the
 *   landcover it is over.
 * - `geography` — under the water, the coastline, the boundaries and the names, but
 *   *over* the roads and buildings: the geographic skeleton stays legible and the road
 *   network stops competing with the field for the same pixels.
 *
 * `geography` is the current choice (2026-09-15, at the client's direction). Flip this
 * one constant to compare; nothing else in the app has an opinion.
 *
 * ## Why `geography` needs the style reordered
 *
 * A style is drawn in array order and `beforeId` is a single insertion point, so what a
 * layer is above or below follows entirely from where it lands. In the OpenMapTiles
 * order the roads sit *between* the water and the boundaries — water, roads, boundaries,
 * names — which means no single insertion point can put water and boundaries above the
 * weather while leaving roads below it.
 *
 * So `geography` does two things rather than one: it anchors at the water, and it moves
 * the road and building layers down to just under that anchor (`sinkBuiltLayers`). The
 * app already rewrites this document to translate its labels, so reordering it is the
 * same kind of change rather than a new liberty.
 */
export const WEATHER_UNDER: 'labels' | 'features' | 'geography' = 'geography';

/**
 * The style layer the app's own raster layers should be drawn beneath.
 *
 * Callers pass the result straight to `beforeId`, where undefined means "on top" — the
 * behaviour before any of this existed, and the right fallback for a style that is still
 * a URL or that failed to load.
 */
export function weatherBeforeLayerId(style: StyleSpecification | string | undefined) {
  return WEATHER_UNDER === 'labels'
    ? firstLabelLayerId(style)
    : firstFeatureLayerId(style) ?? firstLabelLayerId(style);
}

/**
 * Source layers the OpenMapTiles schema puts the built world in. Checked first, because
 * a schema is a contract and a layer id is a style author's habit.
 */
const BUILT_SOURCE_LAYERS = ['transportation', 'transportation_name', 'building', 'aeroway'];

/** The same thing by name, for a style that names its layers but not its sources. */
const BUILT_ID =
  /road|highway|motorway|trunk|street|bridge|tunnel|rail|transit|aeroway|building|ferry/i;

/** Whether a layer draws something built rather than something geographic. */
export function isBuiltLayer(layer: LayerSpecification): boolean {
  const sourceLayer = (layer as { 'source-layer'?: string })['source-layer'];
  if (sourceLayer && BUILT_SOURCE_LAYERS.includes(sourceLayer)) return true;
  return BUILT_ID.test(layer.id);
}

/**
 * Move the roads and buildings down to just under the weather's insertion point.
 *
 * Only layers currently drawn *above* the anchor are moved, and their order among
 * themselves is kept, so the road network still stacks the way its author intended —
 * casings under fills, motorways over tracks. What changes is only where the whole stack
 * sits relative to the weather.
 *
 * Road *names* go down with the road lines. A road dimmed under a temperature field
 * whose label still floats above it reads as a bug rather than as a choice; the names
 * worth keeping on top are the places, and those live in their own layers.
 *
 * One known cost: a road moved below the water fill is hidden where the two overlap, so
 * a bridge over a river loses its line for that span. At the zoom this map opens on, a
 * bridge is a few pixels — and the alternative is either roads over the weather or a
 * far more invasive rewrite that splits the water layer in two.
 */
export function sinkBuiltLayers(
  style: StyleSpecification,
  beforeId: string | undefined
): StyleSpecification {
  if (!beforeId || !Array.isArray(style?.layers)) return style;
  const anchor = style.layers.findIndex((layer) => layer.id === beforeId);
  if (anchor < 0) return style;

  const built: LayerSpecification[] = [];
  const rest: LayerSpecification[] = [];
  style.layers.forEach((layer, index) => {
    // Layers already below the anchor are where they need to be; moving them would
    // reshuffle the ground the weather sits on for no reason.
    if (index > anchor && isBuiltLayer(layer)) built.push(layer);
    else rest.push(layer);
  });
  if (!built.length) return style;

  const at = rest.findIndex((layer) => layer.id === beforeId);
  return { ...style, layers: [...rest.slice(0, at), ...built, ...rest.slice(at)] };
}

/**
 * The style as the map should draw it, given `WEATHER_UNDER`.
 *
 * A no-op for every mode but `geography`, which is the only one that needs the document
 * itself changed rather than an insertion point chosen.
 */
export function orderForWeather(style: StyleSpecification): StyleSpecification {
  if (WEATHER_UNDER !== 'geography') return style;
  return sinkBuiltLayers(style, weatherBeforeLayerId(style));
}

/**
 * The first layer that draws something built or wet, so weather can go under it.
 *
 * The rule is the layer's *kind*, not its name, because this app does not own the style:
 * the first `line` layer (waterways, roads, boundaries) or the first fill that mentions
 * water. Everything before that in an OpenMapTiles style is background and landcover —
 * the ground itself — which is exactly what a temperature field should be allowed to
 * cover.
 *
 * Falls back to the label layer where a style has no such layer at all, so the weather
 * is never left drawing over the names.
 */
export function firstFeatureLayerId(style: StyleSpecification | string | undefined) {
  if (!style || typeof style === 'string' || !Array.isArray(style.layers)) return undefined;
  return style.layers.find(
    (layer) =>
      layer.type === 'line' ||
      (layer.type === 'fill' && JSON.stringify(layer).toLowerCase().includes('water'))
  )?.id;
}

/**
 * The first layer that draws place names, so weather can be slid underneath it.
 *
 * A style's layers are drawn in order, and anything this app adds goes on top of all of
 * them — which buries Amsterdam under the temperature field. MapLibre's `beforeId` puts
 * a layer *under* a named one instead, and the right one to name is the first label
 * layer in the style: everything above it is type, everything below it is ground.
 *
 * Found by walking the layers in order for the first symbol layer that mentions a name,
 * the same blunt test `localiseStyle` uses and for the same reason — this app does not
 * own the style and cannot enumerate its layer ids. Roads, coastlines and water go under
 * the weather, which is right: they are the ground it is falling on. Names go over it,
 * because a name nobody can read is not a label.
 *
 * Undefined where the style is a URL rather than an object, or carries no labels at all.
 * Callers pass it straight to `beforeId`, where undefined means "on top" — the behaviour
 * before this existed, which is also the correct fallback.
 */
export function firstLabelLayerId(style: StyleSpecification | string | undefined) {
  if (!style || typeof style === 'string' || !Array.isArray(style.layers)) return undefined;
  return style.layers.find(
    (layer) => layer.type === 'symbol' && mentionsName(layer.layout?.['text-field'])
  )?.id;
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
