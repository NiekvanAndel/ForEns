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
 * How deep into the basemap a weather layer is drawn — what stays on top of it.
 *
 * - `names` — the boundaries and the place names, and nothing else. The water areas go
 *   under the weather with the roads.
 * - `water` — the water as well, so the lakes and rivers stay blue over the weather.
 *
 * Roads and buildings are under the weather at either depth. A road network painted over
 * a weather layer competes with it for the same pixels and wins, which is what all of
 * this exists to stop.
 *
 * Two other arrangements were tried and dropped: everything-but-the-names on top, and
 * only the landcover underneath. Both left the roads over the weather. A derived
 * coastline — a line traced over the water polygon so a shoreline survived the water
 * sinking — was tried too and dropped with them: at `names` the boundaries already carry
 * the country's shape, and rain is patchy enough that the water reads through it.
 */
export type WeatherDepth = 'names' | 'water';

/**
 * Which depth each layer draws at (2026-09-15, at the client's direction).
 *
 * Only the nowcast loop goes over the water. It is the one layer that is genuinely
 * patchy — a shower covers part of the country and leaves the rest alone — so rain over
 * a lake reads as rain over a lake. Everything else, the rainfall totals included, is a
 * field that covers everything, and a lake painted over by one would simply cease to
 * exist; those keep the water on top.
 */
export const LAYER_DEPTH = {
  nowcast: 'names',
  cumulative: 'water',
  field: 'water',
} as const satisfies Record<string, WeatherDepth>;

// ── Which layers belong over the weather ────────────────────────────────────────

/**
 * Source layers the OpenMapTiles schema files things under. Checked before layer ids,
 * because a schema is a contract and a layer id is a style author's habit.
 */
const SOURCE_LAYERS = {
  /** The built world and its detail. All of it goes under the weather. */
  built: ['transportation', 'transportation_name', 'building', 'aeroway', 'poi',
          'housenumber'],
  water: ['water', 'waterway', 'ocean'],
  boundary: ['boundary'],
};

const BUILT_ID =
  /road|highway|motorway|trunk|street|bridge|tunnel|rail|transit|aeroway|building|ferry|poi|housenumber/i;
const WATER_ID = /water|ocean|river|lake|sea\b/i;
const BOUNDARY_ID = /boundary|border|admin/i;

function sourceLayerOf(layer: LayerSpecification): string | undefined {
  return (layer as { 'source-layer'?: string })['source-layer'];
}

/**
 * Whether a layer draws something built rather than something geographic.
 *
 * The source layer and the id are both consulted rather than one or the other: a style
 * that files its roads under a source this list has never heard of still names them
 * something road-shaped, and getting this wrong is what leaves the motorways painted
 * over the weather.
 */
export function isBuiltLayer(layer: LayerSpecification): boolean {
  const source = sourceLayerOf(layer);
  return (!!source && SOURCE_LAYERS.built.includes(source)) || BUILT_ID.test(layer.id);
}

/** Whether a layer draws water — the areas, not their names. */
export function isWaterLayer(layer: LayerSpecification): boolean {
  if (layer.type === 'symbol') return false;
  const source = sourceLayerOf(layer);
  return (!!source && SOURCE_LAYERS.water.includes(source)) || (!source && WATER_ID.test(layer.id));
}

/** Whether a layer draws a national or regional border. */
export function isBoundaryLayer(layer: LayerSpecification): boolean {
  if (layer.type === 'symbol') return false;
  const source = sourceLayerOf(layer);
  return (
    (!!source && SOURCE_LAYERS.boundary.includes(source)) ||
    (!source && BOUNDARY_ID.test(layer.id))
  );
}

/** Whether a layer draws a name — the same blunt test `localiseStyle` uses. */
export function isLabelLayer(layer: LayerSpecification): boolean {
  return layer.type === 'symbol' && mentionsName(layer.layout?.['text-field']);
}

/**
 * The band a layer belongs to, counting up from the ground.
 *
 * 0 is the ground and everything built on it, 1 is the water, 2 is the boundaries and
 * the names. Three bands is what lets one style serve both depths at once: rain goes in
 * at the 1|2 seam and a field at the 0|1 seam, so the same document draws a shower over
 * the IJsselmeer and a temperature field under it.
 *
 * A road *name* is a label by every other test and still belongs in band 0. A road
 * hidden under a field whose label floats above it reads as a bug, not a choice.
 */
export function bandOf(layer: LayerSpecification): 0 | 1 | 2 {
  if (isBuiltLayer(layer)) return 0;
  if (isBoundaryLayer(layer) || isLabelLayer(layer)) return 2;
  if (isWaterLayer(layer)) return 1;
  return 0;
}

// ── Putting the weather into the style ──────────────────────────────────────────

/**
 * The style as the map should draw it: the three bands, in order.
 *
 * Sorting into bands rather than moving individual layers is what keeps each band
 * stacked the way its author drew it — road casings under road fills, boundaries under
 * names. What changes is only where the seams fall.
 *
 * **It is idempotent, and that is load-bearing.** The seam is found by asking the same
 * question of the ordered style that built it, so ordering an already-ordered style is a
 * no-op and the answer does not move. An earlier version found its insertion point by
 * position — the first line layer — and its own reordering changed what that was: the
 * roads slid below the water, became the first line layer themselves, and the weather
 * was inserted beneath them. Roads over the weather, which is precisely what this exists
 * to prevent.
 */
export function orderForWeather(style: StyleSpecification): StyleSpecification {
  if (!Array.isArray(style?.layers)) return style;
  const bands: LayerSpecification[][] = [[], [], []];
  for (const layer of style.layers) bands[bandOf(layer)]!.push(layer);
  return { ...style, layers: [...bands[0]!, ...bands[1]!, ...bands[2]!] };
}

/**
 * What the banding did to a style, as one line per band.
 *
 * The basemap is fetched at runtime from a host this project cannot reach from a
 * build machine, so its layer ids are known only by schema and habit. When the map comes
 * up with something over the weather that should be under it, this is how to find out
 * which layer landed where instead of guessing at it — see `useLocalisedMapStyle`, which
 * prints it in development.
 */
export function describeBands(style: StyleSpecification): string {
  const names = ['under the weather', 'water', 'boundaries and names'];
  return [0, 1, 2]
    .map((band) => {
      const ids = style.layers.filter((layer) => bandOf(layer) === band).map((l) => l.id);
      return `  band ${band} (${names[band]}): ${ids.length} — ${ids.slice(0, 12).join(', ')}${
        ids.length > 12 ? ', …' : ''
      }`;
    })
    .join('\n');
}

/**
 * The style layer a weather layer at this depth should be drawn beneath.
 *
 * `water` goes in under the water, `names` under the boundaries and the names. Callers
 * pass the result straight to `beforeId`, where undefined means "on top" — the behaviour
 * before any of this existed, and the right fallback for a style that is still a URL or
 * that failed to load.
 *
 * A style with no water at all still puts a `water` layer below the names rather than
 * over them: the seam falls back up a band, never off the top.
 */
export function weatherBeforeLayerId(
  style: StyleSpecification | string | undefined,
  depth: WeatherDepth
): string | undefined {
  if (!style || typeof style === 'string' || !Array.isArray(style.layers)) return undefined;
  const from = depth === 'water' ? 1 : 2;
  return (
    style.layers.find((layer) => bandOf(layer) >= from)?.id ??
    style.layers.find((layer) => bandOf(layer) >= 2)?.id
  );
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
