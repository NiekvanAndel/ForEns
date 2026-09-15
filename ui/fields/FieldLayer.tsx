/**
 * The field overlays on the map.
 *
 * Every frame goes up as its own image source and stepping only flips which one is
 * opaque — the rule `RadarLayer` is built on, and the reason both loops animate without
 * a blank between frames. Nothing is fetched, decoded or re-rasterised while the play
 * head is running.
 *
 * ## Under the basemap's own marks, and short of solid
 *
 * The layer is inserted into the basemap rather than laid over it, so the map keeps the
 * marks that make it a map. How deep is `LAYER_DEPTH.field` in `../radar/mapStyle`: under
 * the water as well as the boundaries and the names, which is a band deeper than either
 * rain layer goes. A field covers the whole country by design — unlike a shower, which
 * leaves most of the map alone — so a lake it painted over would simply cease to exist,
 * and without any of this the map loses every name it has the moment the layer comes up.
 *
 * It is drawn well short of solid on top of that. The overlay already carries its own
 * fade — its alpha is the posterior's uncertainty — and this is a second, flat one over
 * it, so the roads and the towns under the field still read as the ground it is drawn
 * on. Layer order decides what is painted over what; this decides how much of what is
 * underneath survives being covered. They are separate questions and this layer answers
 * both.
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

/**
 * How opaque the visible frame is drawn (0.7, at the client's direction, 2026-09-15).
 *
 * Well short of solid, and deliberately: roughly a third of the basemap comes through,
 * so the road network and the built-up areas still read as a faint ground under the
 * field. That is a different question from the layer order — the roads are *under* the
 * weather either way (`LAYER_DEPTH`), this decides how much of them survives the
 * covering. Lower than either rain layer, because a field covers the whole country and
 * would otherwise erase the map it is drawn on.
 */
const OVERLAY_OPACITY = 0.7;

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
