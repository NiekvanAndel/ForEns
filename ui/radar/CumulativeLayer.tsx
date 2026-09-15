/**
 * The cumulative rainfall overlays on the map.
 *
 * Every published window goes up as its own image source and the slider only flips
 * which one is opaque — the same rule `RadarLayer` is built on, and for the same
 * reason. Six PNGs is a megabyte at most; decoding one mid-drag would make the slider
 * stutter exactly where the reader is comparing totals.
 *
 * The images are palette PNGs with transparent dry ground, so they can be drawn at a
 * higher opacity than the radar loop without burying the coastline: what is painted
 * here is only the wet part.
 *
 * Like the field layers, they are inserted into the basemap at `LAYER_DEPTH.cumulative`
 * rather than laid over it, so the water, the boundaries and the place names stay
 * readable through the wettest block of the ramp.
 */
import { ImageSource, Layer } from '@maplibre/maplibre-react-native';
import type { LngLat } from '@maplibre/maplibre-react-native';
import { overlayBounds, type CumulativeManifest, type CumulativeSource, type CumulativeWindow } from '../../core/radar/cumulative';
import type { GeoBounds } from '../../core/radar';

/** Solid enough to read a total off the ramp, short of hiding the map under it. */
const OVERLAY_OPACITY = 0.82;

/** No cross-fade between windows, and no smoothing of the grid. A dissolve between
 *  two totals would render a field that was never measured; `nearest` keeps the
 *  raster's own cells, which is the resolution the numbers actually have. */
const PAINT = {
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

export interface CumulativeLayerProps {
  manifest: CumulativeManifest;
  windows: CumulativeWindow[];
  /** The window on screen; every other one stays mounted at zero opacity. */
  active: CumulativeWindow | undefined;
  source: CumulativeSource;
  /** The style layer to draw beneath, so the labels stay on top. */
  beforeId?: string;
}

export function CumulativeLayer({
  manifest, windows, active, source, beforeId,
}: CumulativeLayerProps) {
  const corners = cornersOf(overlayBounds(manifest));

  return (
    <>
      {windows.map((window) => {
        let url: string;
        try {
          url = source.overlayUrl(window);
        } catch {
          // A window the source cannot draw is left out rather than mounted blank,
          // which would be indistinguishable from an hour with no rain in it.
          return null;
        }
        return (
          <ImageSource
            key={`cumulative-${window.hours}`}
            id={`cumulative-${window.hours}`}
            url={url}
            coordinates={corners}
          >
            <Layer
              type="raster"
              id={`cumulative-layer-${window.hours}`}
              beforeId={beforeId}
              paint={{
                ...PAINT,
                'raster-opacity': window.hours === active?.hours ? OVERLAY_OPACITY : 0,
              }}
            />
          </ImageSource>
        );
      })}
    </>
  );
}
