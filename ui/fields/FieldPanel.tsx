/**
 * The panel under the map while a field layer is up: the slider, and nothing else.
 *
 * It started as a reading — the variable, the value at the selected location, the clock
 * — and that was all duplication. The map already carries every one of those: the value
 * is in the bubble on the location, the moment is in the badge in the top-right corner,
 * and the variable is what the reader just picked from the layer menu. A panel that
 * repeats the map is a panel that competes with it, and this screen is the map.
 *
 * So what is left is the one thing the map cannot carry, because it is a control rather
 * than a fact: the play button and the track. Which is also the rule `FullMap` applies
 * everywhere else — something on screen has to be draggable.
 *
 * The exception is a layer that is not there yet. A loading or unavailable state has no
 * track to drag and nothing on the map either, so it says so in a line; that is not a
 * reading, it is the reason the screen is empty.
 */
import { View } from 'react-native';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import { FieldTimeline } from './FieldTimeline';
import type { FieldFrame, FieldManifest } from '../../core/fields';
import type { FieldStatus } from './useFields';

export interface FieldPanelProps {
  status: FieldStatus;
  manifest: FieldManifest | null;
  frames: readonly FieldFrame[];
  index: number;
  onIndexChange: (index: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  /** Seconds the server asked us to wait, when it says the layers are not built. */
  retryAfterSec: number | null;
}

export function FieldPanel({
  status, manifest, frames, index, onIndexChange, playing, onTogglePlay, retryAfterSec,
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

  return (
    <View style={{ paddingHorizontal: space[5], paddingTop: space[4] }}>
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
