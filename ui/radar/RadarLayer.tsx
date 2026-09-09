/**
 * The radar imagery on a map, for whichever shape the active provider serves.
 *
 * Both radar maps — the preview card on 'Nu' and the full radar screen — draw their
 * frames through here, so the tile/overlay distinction lives in one place instead of
 * in every map.
 *
 * ## Why only the active frame is mounted
 *
 * An earlier version mounted every frame and drove visibility with `opacity`, to
 * avoid a flash between steps. On iOS that renders nothing at all: react-native-maps
 * does not honour per-overlay opacity on `UrlTile`, so the overlays stacked and the
 * map stayed blank. The same trap is waiting on `Overlay`, whose `opacity` prop is
 * documented as Google Maps only and is therefore inert on the Apple Maps provider
 * this app uses. So one frame is mounted at a time, keyed so it remounts on a step,
 * and `warmFrames` below fills the image cache instead — which is what makes replay
 * smooth without depending on a prop that does nothing here.
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
    return (
      <Overlay
        key={frame.id}
        image={{ uri: overlay.url }}
        bounds={boundsProp(overlay.bounds)}
      />
    );
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
