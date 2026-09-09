/**
 * The radar imagery on a map, for whichever shape the active provider serves.
 *
 * Both radar maps — the preview card on 'Nu' and the full radar screen — draw their
 * frames through here, so the tile/overlay distinction lives in one place instead of
 * in every map.
 *
 * ## Why the overlay is mounted once and only its image changes
 *
 * Never add or remove a map layer per animation step. AIRMapOverlay loads its image
 * asynchronously and, on completion, calls an `update` that does
 * `[_map removeOverlay:self]; [_map addOverlay:self];` — without ever checking that
 * it is still supposed to be on the map, and without `_map` being cleared when React
 * removes it. So a frame unmounted while its image was still loading put *itself*
 * back on the map when the load finished, and stepping through the loop stacked
 * every frame it had ever shown into one illegible picture.
 *
 * So there is exactly one `Overlay`, mounted for as long as the map is, and stepping
 * the loop changes its `image`. That routes through `setImageSrc`, which cancels the
 * previous load and swaps the picture in place — the library's own intended path,
 * and the only one that leaves a single layer on the map. Its bounds are fixed
 * across a run, so nothing else about it changes.
 *
 * Note that the obvious alternative — mount every frame, flip `opacity` — is not
 * available here: `Overlay`'s `opacity` is documented as Google Maps only, and the
 * iOS renderer never reads it, so on the Apple Maps provider this app uses every
 * frame would be fully opaque and stacked.
 *
 * ## Why the overlay is drawn at full strength
 *
 * The tiles were drawn at 0.75 so the map stayed readable underneath. The DGMR PNGs
 * do that themselves: everything below 0.1 mm/h is fully transparent, and the rain
 * is a log-scale ramp designed to be laid over a map. Fading them further would only
 * wash out light rain, and on Apple Maps `opacity` would be ignored regardless.
 */
import { useEffect } from 'react';
import { Image } from 'react-native';
import { Overlay, UrlTile } from 'react-native-maps';
import { MAX_DISPLAY_Z } from './mapStyle';
import type { GeoBounds, RadarFrame, RadarProvider } from '../../core/radar';

/** How opaque the tile pyramid is drawn, where a provider serves one. */
const TILE_OPACITY = 0.75;

/** iOS reads `bounds` as [north-east, south-west], each `[lat, lng]` — see
 *  AIRMapOverlay's `setBoundsRect`. */
function boundsProp(b: GeoBounds): [[number, number], [number, number]] {
  return [
    [b.north, b.east],
    [b.south, b.west],
  ];
}

/**
 * Pull every frame's image into the RN image cache.
 *
 * Only one frame is mounted at a time, so without this the first pass of the loop
 * downloads a 765×820 PNG per step and stutters. The native overlay loads its image
 * through the same `ImageLoader` this warms, which is what makes it work at all. The
 * frames are immutable and their names change every run, so warming them costs one
 * fetch each per run.
 */
export function useWarmFrames(provider: RadarProvider, frames: readonly RadarFrame[]): void {
  useEffect(() => {
    if (provider.kind !== 'overlay' || !frames.length) return;
    for (const url of provider.frameImageUrls(frames)) {
      // A frame that fails to warm still loads when it is mounted, so there is
      // nothing to report and nothing to retry. Nor is there anything to undo on
      // unmount: a warmed frame is wanted by the next screen too.
      Image.prefetch(url).catch(() => {});
    }
  }, [provider, frames]);
}

export interface RadarLayerProps {
  provider: RadarProvider;
  frame: RadarFrame | undefined;
  /** Set on the radar screen, where a reader can zoom past the provider's deepest
   *  level and react-native-maps' cached-overlay path is wanted. Left off on the
   *  preview card, whose region is fixed and cannot over-zoom. */
  cacheTiles?: boolean;
}

export function RadarLayer({ provider, frame, cacheTiles = false }: RadarLayerProps) {
  if (!frame) return null;

  if (provider.kind === 'overlay') {
    const overlay = provider.frameOverlay(frame);
    if (!overlay) return null;
    // Deliberately unkeyed: a changing key would remount this per step, which is
    // the stacking bug described above. One overlay, a new `image` each step.
    return <Overlay image={{ uri: overlay.url }} bounds={boundsProp(overlay.bounds)} />;
  }

  return (
    <UrlTile
      key={frame.id}
      urlTemplate={provider.tileTemplate({ frame })}
      {...(cacheTiles ? { maximumNativeZ: provider.maxZoom, maximumZ: MAX_DISPLAY_Z } : { maximumZ: provider.maxZoom })}
      tileSize={provider.tileSize}
      zIndex={1}
      opacity={TILE_OPACITY}
    />
  );
}
