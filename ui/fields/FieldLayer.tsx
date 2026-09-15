/**
 * The field overlays on the map.
 *
 * Every frame goes up as its own image source and stepping only flips which one is
 * opaque — the rule `RadarLayer` is built on, and the reason both loops animate without
 * a blank between frames. Nothing is fetched, decoded or re-rasterised while the play
 * head is running.
 *
 * ## Full opacity, and linear resampling
 *
 * Two deliberate differences from the radar layers above.
 *
 * The overlay is drawn solid rather than at 0.8, because it arrives already faded: its
 * alpha is the posterior's own uncertainty, so it is solid where stations anchor the
 * field and gone where the regression was only extrapolating. Dimming it again would
 * dim a judgement the pipeline already made, and leave a thin wash over ground where
 * there is nothing to say.
 *
 * And the raster is resampled linearly, where radar uses `nearest`. The radar's cells
 * are measurements and interpolating them invents precision; this is a *posterior mean
 * field* — smooth by construction, evaluated on a grid — so a smooth enlargement is
 * closer to what the model says than a staircase of kilometre squares would be.
 */
import { ImageSource, Layer } from '@maplibre/maplibre-react-native';
import type { LngLat } from '@maplibre/maplibre-react-native';
import { overlayBounds, type FieldFrame, type FieldManifest, type FieldSource } from '../../core/fields';
import type { GeoBounds } from '../../core/radar';

/** Solid: the image's own alpha is where this layer stops. */
const OVERLAY_OPACITY = 1;

const PAINT = {
  'raster-fade-duration': 0,
  'raster-opacity-transition': { duration: 0, delay: 0 },
  'raster-resampling': 'linear',
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

export interface FieldLayerProps {
  manifest: FieldManifest;
  frames: readonly FieldFrame[];
  /** The frame to show. Everything else stays mounted at zero opacity. */
  active: FieldFrame | undefined;
  source: FieldSource;
}

export function FieldLayer({ manifest, frames, active, source }: FieldLayerProps) {
  const corners = cornersOf(overlayBounds(manifest));

  return (
    <>
      {frames.map((frame) => {
        let url: string;
        try {
          url = source.overlayUrl(manifest, frame);
        } catch {
          // A frame the source cannot draw is left out rather than mounted blank. On a
          // layer that fades out by design, a blank frame is indistinguishable from
          // ground the regression had nothing to say about.
          return null;
        }
        const id = `field-${manifest.variable}-${frame.time}`;
        return (
          <ImageSource key={id} id={id} url={url} coordinates={corners}>
            <Layer
              type="raster"
              id={`${id}-layer`}
              paint={{
                ...PAINT,
                'raster-opacity': frame.time === active?.time ? OVERLAY_OPACITY : 0,
              }}
            />
          </ImageSource>
        );
      })}
    </>
  );
}
