/**
 * The radar imagery on a map, for whichever shape the active provider serves.
 *
 * Both radar maps — the preview card on 'Nu' and the full radar screen — draw their
 * frames through here, so the tile/overlay distinction lives in one place instead of
 * in every map.
 *
 * ## Every frame is mounted, and a step only changes opacity
 *
 * This is the whole reason the radar animates cleanly, and it is the one rule to
 * keep: never add or remove a map layer per animation step. All the frames go up as
 * their own raster layers when the loop loads, and stepping flips which one is
 * opaque. Nothing is fetched, decoded or re-rasterised while the loop plays, so
 * there is no blank between frames and no way for a slow image to arrive after its
 * turn has passed.
 *
 * The transitions are pinned to zero for the same reason. MapLibre would otherwise
 * cross-fade an opacity change and fade a raster layer in over its default
 * `raster-fade-duration`, which on a loop stepping every 450 ms reads as two frames
 * dissolving into each other rather than as weather moving.
 *
 * This is what the Apple Maps implementation could not do, and why the app moved off
 * it — see ./mapStyle for that history.
 *
 * ## Into the basemap, not over it
 *
 * `beforeId` puts the frames beneath part of the basemap rather than over all of it, at
 * `LAYER_DEPTH.nowcast`: the coastline, the boundaries and the place names stay on top,
 * the water goes under. Rain over a lake is rain, and a shower leaves most of the map
 * alone anyway — which is why this layer can afford to cover the water where a
 * temperature field cannot.
 */
import { ImageSource, Layer, RasterSource } from '@maplibre/maplibre-react-native';
import type { LngLat } from '@maplibre/maplibre-react-native';
import type { GeoBounds, RadarFrame, RadarProvider } from '../../core/radar';

/** How opaque the visible frame is drawn. Short of solid, so the basemap reads through
 *  moderate rain rather than being buried by it. */
const FRAME_OPACITY = 0.85;

/**
 * No cross-fade, no smoothing.
 *
 * `raster-opacity-transition` at zero is what makes a step instant rather than a
 * dissolve; `raster-fade-duration` at zero stops MapLibre fading a layer in on its
 * own. `nearest` leaves the radar's own pixels alone — this is a 1 km grid, and
 * interpolating it invents a precision the data does not have.
 */
const RADAR_PAINT = {
  'raster-fade-duration': 0,
  'raster-opacity-transition': { duration: 0, delay: 0 },
  'raster-resampling': 'nearest',
} as const;

/** MapLibre wants the four corners clockwise from the top left. */
function cornersOf(b: GeoBounds): [LngLat, LngLat, LngLat, LngLat] {
  return [
    [b.west, b.north],
    [b.east, b.north],
    [b.east, b.south],
    [b.west, b.south],
  ];
}

export interface RadarLayerProps {
  provider: RadarProvider;
  frames: readonly RadarFrame[];
  /** The frame to show. Everything else stays mounted at zero opacity. */
  active: RadarFrame | undefined;
  /** The style layer to draw beneath, so the labels stay on top. */
  beforeId?: string;
}

export function RadarLayer({ provider, frames, active, beforeId }: RadarLayerProps) {
  if (provider.kind === 'overlay') {
    return (
      <>
        {frames.map((frame) => {
          const overlay = provider.frameOverlay(frame);
          if (!overlay) return null;
          return (
            <ImageSource
              key={frame.id}
              id={`radar-${frame.id}`}
              url={overlay.url}
              coordinates={cornersOf(overlay.bounds)}
            >
              <Layer
                type="raster"
                id={`radar-layer-${frame.id}`}
                beforeId={beforeId}
                paint={{
                  ...RADAR_PAINT,
                  'raster-opacity': frame.id === active?.id ? FRAME_OPACITY : 0,
                }}
              />
            </ImageSource>
          );
        })}
      </>
    );
  }

  // A tile provider serves a pyramid rather than an image, but the rule above is
  // unchanged: every frame is its own source, and a step only flips opacity.
  return (
    <>
      {frames.map((frame) => (
        <RasterSource
          key={frame.id}
          id={`radar-${frame.id}`}
          tiles={[provider.tileTemplate({ frame })]}
          tileSize={provider.tileSize}
          maxzoom={provider.maxZoom}
        >
          <Layer
            type="raster"
            id={`radar-layer-${frame.id}`}
            beforeId={beforeId}
            paint={{
              ...RADAR_PAINT,
              'raster-opacity': frame.id === active?.id ? FRAME_OPACITY : 0,
            }}
          />
        </RasterSource>
      ))}
    </>
  );
}
