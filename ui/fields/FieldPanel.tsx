/**
 * The panel under the map while a field layer is up.
 *
 * It replaces the nowcast profile rather than joining it, for the reason the totals
 * panel does: the curve above answers "how hard will it rain here soon", and this
 * answers "what is the temperature here, at the moment the map is showing". They share
 * a location and nothing else.
 *
 * ## One reading, and the slider under it
 *
 * There is no curve here, and that is a decision rather than an omission. A curve of
 * this location's value across the loop is the obvious next thing to draw — and drawing
 * it means a value per frame per location, which today means pulling down a raster per
 * frame to read one cell out of each. The contract anticipates a point endpoint for
 * exactly that, and the curve belongs in the same change. Until then the panel says one
 * true thing clearly instead of a dozen expensively.
 *
 * So the timeline always stands here rather than trading places with a curve, which is
 * the rule `FullMap` already applies where the nowcast has nothing to draw: something on
 * screen has to be draggable.
 *
 * ## What it says beside the number
 *
 * The reading is coloured from the manifest's own ramp, so the figure, the bubble on the
 * map and the ground under it are one colour — three renderings of one value that can be
 * checked against each other at a glance.
 *
 * And while the layer runs on the bundled fixture, it says so. Every frame before the
 * newest was derived by advecting one real snapshot, and a loop of scaffolding that
 * presented itself as two hours of weather would be the worst thing on this screen.
 */
import { View } from 'react-native';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import { FieldTimeline } from './FieldTimeline';
import {
  formatFieldValue, frameClock, isSynthetic, legendColorFor, loopMinutes, unitLabel,
  type FieldFrame, type FieldManifest, type FieldVariable,
} from '../../core/fields';
import type { FieldStatus } from './useFields';

export interface FieldPanelProps {
  status: FieldStatus;
  manifest: FieldManifest | null;
  frames: readonly FieldFrame[];
  index: number;
  onIndexChange: (index: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  /** The value at the selected location for the frame on screen, or null. */
  value: number | null;
  /** Null while the raster for this frame is still on its way, which reads differently
   *  from a location the field has nothing to say about. */
  loading: boolean;
  locationName?: string;
  retryAfterSec: number | null;
}

export function FieldPanel({
  status, manifest, frames, index, onIndexChange, playing, onTogglePlay,
  value, loading, locationName, retryAfterSec,
}: FieldPanelProps) {
  const { palette } = useTheme();

  if (status !== 'ready' || !manifest) {
    const message =
      status === 'loading'
        ? 'Kaartlaag laden…'
        : status === 'unavailable'
          ? `Nog niet beschikbaar${retryAfterSec ? `, probeer het over ${retryAfterSec} s` : ''}`
          : 'Kaartlaag niet beschikbaar';
    return (
      <View style={{ paddingHorizontal: space[5], paddingVertical: space[4] }}>
        <Text variant="body" color={palette.muted}>
          {message}
        </Text>
      </View>
    );
  }

  const frame = frames[index];
  const tint = legendColorFor(manifest.legend, value);
  const hours = loopMinutes(manifest) / 60;

  return (
    <View style={{ paddingHorizontal: space[5], paddingTop: space[4], gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
        <Text variant="caption" weight="bold" color={palette.inkHeading}>
          {manifest.label}
        </Text>
        {locationName ? (
          <Text variant="caption" color={palette.muted} numberOfLines={1} style={{ flex: 1 }}>
            {locationName}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
        <Text variant="metric" weight="bold" color={tint ?? palette.inkHeading} tabular>
          {loading && value == null ? '·' : formatFieldValue(manifest.variable as FieldVariable, value)}
        </Text>
        <Text variant="body" color={palette.muted}>
          {unitLabel(manifest.unit)}
        </Text>
        <View style={{ flex: 1 }} />
        {frame ? (
          <Text variant="caption" color={palette.muted} tabular>
            {frameClock(frame)}
          </Text>
        ) : null}
      </View>

      {value == null && !loading ? (
        <Text variant="caption" color={palette.muted}>
          Geen waarde voor deze locatie — buiten het gebied of te onzeker om te tonen.
        </Text>
      ) : null}

      {isSynthetic(manifest) ? (
        <Text variant="caption" color={palette.muted}>
          {`Testdata: alleen ${frameClock(frames[frames.length - 1]!)} is gemeten, de ${
            frames.length - 1
          } eerdere beelden zijn afgeleid.`}
        </Text>
      ) : (
        <Text variant="caption" color={palette.muted}>
          {`Meetnetten van KNMI, AgroExact en anderen · ${hours} uur terug`}
        </Text>
      )}

      <FieldTimeline
        frames={frames}
        index={index}
        onIndexChange={onIndexChange}
        playing={playing}
        onTogglePlay={onTogglePlay}
      />
    </View>
  );
}
