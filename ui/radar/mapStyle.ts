/**
 * Shared decisions for both maps — the preview on 'Nu' and the full radar screen.
 *
 * ## Why the pins are MapKit's own, not React views
 *
 * A `Marker` with React children is rasterised by react-native-maps into an
 * annotation image. Two things went wrong with that here: the snapshot could be
 * taken before the child had laid out, leaving an empty annotation, and — reported
 * after the first fix — the annotation held its screen position while the map moved
 * underneath it, so the "you are here" dot drifted off the place it marks.
 *
 * Both are properties of the custom-view path, not of the pin's design. So the pins
 * are now plain `<Marker pinColor>` annotations, which MapKit positions itself and
 * which cannot come out blank. The cost is the pulse ring, which was decoration; a
 * dot that is in the wrong place is worse than a dot that does not breathe.
 *
 * ## Why two zoom limits
 *
 * `maximumNativeZ` is the deepest level tiles exist for; `maximumZ` is the deepest
 * level the overlay is drawn at. Setting only the latter to the provider's limit is
 * what produced "Zoom Level Not Supported" — past it MapKit stopped drawing rather
 * than upscaling.
 *
 * Upscaling has a limit of its own, though: stretched far enough the tiles are mush,
 * and RainViewer serves a placeholder image rather than a tile at some levels. So the
 * map is clamped at *both* ends — `MIN_ZOOM` because the whole-world levels are the
 * ones most likely to be missing, `maxZoomFor` a little past the native maximum —
 * and every starting region is chosen to sit inside that band.
 */
import type { Appearance, Palette } from '../../theme';

/** How far the tile overlay is drawn. Past the provider's native limit MapKit
 *  upscales its deepest tiles rather than dropping the layer. */
export const MAX_DISPLAY_Z = 19;

/** How far the map itself will zoom in. Two levels past the provider's own maximum
 *  is as far as upscaled tiles stay readable. */
export const maxZoomFor = (providerMaxZoom: number) => providerMaxZoom + 2;

/** How far out the map will go. Below this a radar tile covers a continent, which
 *  providers commonly do not serve at all. */
export const MIN_ZOOM = 4;

/** The region a radar map opens on, in degrees. Around zoom 7 on a phone: the
 *  country and the weather heading for it, comfortably inside the tile range. */
export const START_SPAN_DEG = 2.6;

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
