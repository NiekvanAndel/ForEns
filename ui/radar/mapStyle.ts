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
 * NOTE: `tiles.openfreemap.org` is unreachable from the build environment (the
 * network policy blocks it), so the dark style below is named from its documented
 * set but could not be requested. If the map comes up blank in dark mode, that URL
 * is the thing to change — CARTO's `dark-matter` is the drop-in alternative, noted
 * beside it.
 *
 * ## Why the map is clamped at both ends
 *
 * The radar imagery is one image per frame at about a kilometre per pixel, so past
 * the provider's own maximum the map is only scaling it up, and far enough in it is
 * mush. Out at the whole-world levels the basemap has nothing useful to say about a
 * shower over Brabant either. So the camera is held inside a band and every starting
 * view is chosen to sit within it.
 */
import type { Appearance, Palette } from '../../theme';

/** The basemap, per appearance. Light and dark are the same cartography in two
 *  palettes, so the map does not change character with the theme.
 *
 *  If dark ever 404s, CARTO's equivalent is
 *  `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json` — it needs an
 *  attribution line, which OpenFreeMap's own styles already carry. */
const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

export function mapStyleFor(appearance: Appearance): string {
  return appearance === 'dark' ? STYLE_DARK : STYLE_LIGHT;
}

/** How far out the map will go. Below this a radar frame covers a continent. */
export const MIN_ZOOM = 4;

/** How far in. Two levels past the provider's own maximum is as far as an upscaled
 *  radar image stays readable. */
export const maxZoomFor = (providerMaxZoom: number) => providerMaxZoom + 2;

/** The zoom a radar map opens on: the country and the weather heading for it, and
 *  the same framing the map had before the move to MapLibre. */
export const START_ZOOM = 7;

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
