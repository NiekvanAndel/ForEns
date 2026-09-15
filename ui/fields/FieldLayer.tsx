/**
 * The field overlays on the map.
 *
 * Every frame goes up as its own image source and stepping only flips which one is
 * opaque — the rule `RadarLayer` is built on, and the reason both loops animate without
 * a blank between frames. Nothing is fetched, decoded or re-rasterised while the play
 * head is running.
 *
 * ## Under the labels, and short of solid
 *
 * The layer goes under the style's first label layer, so town names, the coastline's
 * type and the motorway shields stay on top of the weather. A field covers the whole
 * country by design — unlike a shower, which leaves most of the map alone — so without
 * this the map loses every name it has the moment the layer comes up. Roads and water
 * stay underneath, which is right: they are the ground the weather is over.
 *
 * It is drawn a little short of solid for the same reason. The overlay already carries
 * its own fade — its alpha is the posterior's uncertainty — and this is a second, flat
 * one on top: enough that the coastline and the larger roads read through, not so much
 * that the ramp stops meaning a temperature. The same value the cumulative layer uses,
 * so two layers that answer different questions at least look like one product.
 *
 * ## Linear resampling
 *
 * Where radar uses `nearest`. The radar's cells are measurements and interpolating them
 * invents precision; this is a *posterior mean field* — smooth by construction,
 * evaluated on a grid — so a smooth enlargement is closer to what the model says than a
 * staircase of kilometre squares would be.
 */
import { ImageSource, Layer } from '@maplibre/maplibre-react-native';
import type { LngLat } from '@maplibre/maplibre-react-native';
import { overlayBounds, type FieldFrame, type FieldManifest, type FieldSource } from '../../core/fields';
import type { GeoBounds } from '../../core/radar';

/** Short of solid, so the basemap reads through. Matches `CumulativeLayer`. */
const OVERLAY_OPACITY = 0.82;

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
  /** The style layer to draw beneath, so the labels stay on top. Undefined draws on
   *  top of everything, which is what happens while the style is still loading. */
  beforeId?: string;
}

export function FieldLayer({ manifest, frames, active, source, beforeId }: FieldLayerProps) {
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
              beforeId={beforeId}
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
