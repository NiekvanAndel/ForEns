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
 * How place names are drawn, per appearance.
 *
 * The stock dark basemap prints them white with a black halo, which is right over a dark
 * map and wrong over ours: with a weather field underneath, the ground is orange or blue
 * rather than navy, and black-haloed white type reads as a sticker rather than a label.
 *
 * So dark mode takes the light basemap's arrangement — dark ink, white halo (2026-09-15,
 * at the client's direction, who asked for the white halo). The halo had to bring the ink
 * with it: white type inside a white halo is not a lighter label, it is no label.
 *
 * Both appearances are set rather than only the one that changed, so the labels are the
 * app's decision in both and not the basemap author's in one of them.
 */
export const LABEL_STYLE: Record<Appearance, { ink: string; halo: string; haloWidth: number }> = {
  light: { ink: '#0C2547', halo: '#FFFFFF', haloWidth: 1.4 },
  dark: { ink: '#0C2547', halo: '#FFFFFF', haloWidth: 1.6 },
};

/**
 * Repaint the labels that draw names, leaving what they say alone.
 *
 * Only `text-color` and the halo are touched, and only on the layers `localiseStyle`
 * already recognises — so road shields keep their own colours and nothing here can blank
 * a label. A layer that set these with an expression (a colour that shifts with zoom) is
 * overwritten flat, which is the point: one ink for every name, whatever is under it.
 */
export function restyleLabels(
  style: StyleSpecification,
  appearance: Appearance
): StyleSpecification {
  if (!Array.isArray(style?.layers)) return style;
  const { ink, halo, haloWidth } = LABEL_STYLE[appearance];
  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (layer.type !== 'symbol' || !mentionsName(layer.layout?.['text-field'])) return layer;
      return {
        ...layer,
        paint: {
          ...layer.paint,
          'text-color': ink,
          'text-halo-color': halo,
          'text-halo-width': haloWidth,
        },
      } as LayerSpecification;
    }),
  };
}

/**
 * How deep into the basemap the weather is buried.
 *
 * `labels` puts it under the names only, so roads, water and the coastline are drawn on
 * top of the weather and only the ground beneath it. `features` puts it under the water
 * and the roads as well, so a field covers nothing but the landcover it is over.
 *
 * `features` is the current choice (2026-09-15, at the client's direction). Flip this
 * one constant to compare; nothing else in the app has an opinion.
 */
export const WEATHER_UNDER: 'labels' | 'features' = 'features';

/**
 * The style layer the app's own raster layers should be drawn beneath.
 *
 * Callers pass the result straight to `beforeId`, where undefined means "on top" — the
 * behaviour before any of this existed, and the right fallback for a style that is still
 * a URL or that failed to load.
 */
export function weatherBeforeLayerId(style: StyleSpecification | string | undefined) {
  return WEATHER_UNDER === 'features'
    ? firstFeatureLayerId(style) ?? firstLabelLayerId(style)
    : firstLabelLayerId(style);
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
