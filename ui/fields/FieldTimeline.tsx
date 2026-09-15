/**
 * The field loop's timeline: a play button and a track across the frames.
 *
 * `Timeline` next door does the same job for the radar, and is not reused: it is typed
 * to `RadarFrame` and it marks the observed/forecast boundary, which is the one thing
 * this loop does not have. Everything here is observation. What the two do share is
 * `Scrubber`, which is the control itself — so the thumb, the rail and the drag behave
 * identically whichever layer is up, and only the labels differ.
 *
 * The ends are labelled with how far back the track reaches, and the middle carries
 * nothing: the clock for the frame on screen is the badge in the map's top-right corner,
 * and printing it again under the thumb would be the same fact twice, eight inches apart.
 */
import { Pressable, View } from 'react-native';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { Scrubber } from '../radar/Scrubber';
import { backLabel, type FieldFrame } from '../../core/fields';

export interface FieldTimelineProps {
  /** Oldest first, as the track runs. */
  frames: readonly FieldFrame[];
  index: number;
  onIndexChange: (index: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
}

export function FieldTimeline({
  frames, index, onIndexChange, playing, onTogglePlay,
}: FieldTimelineProps) {
  const { palette } = useTheme();
  const disabled = frames.length < 2;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <Pressable
        onPress={onTogglePlay}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Tijdlijn pauzeren' : 'Tijdlijn afspelen'}
        disabled={disabled}
        style={{
          width: 42, height: 42, borderRadius: radius.pill,
          backgroundColor: disabled ? palette.inkDisabled : palette.accent,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon name={playing ? 'pause' : 'play'} size={18} color="#fff" weight="fill" />
      </Pressable>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text variant="caption" color={palette.muted} tabular>
            {backLabel(frames, 0)}
          </Text>
          <Text variant="caption" color={palette.muted} tabular>
            {backLabel(frames, frames.length - 1)}
          </Text>
        </View>

        <Scrubber
          value={index}
          steps={frames.length}
          onChange={onIndexChange}
          disabled={disabled}
          accessibilityLabel="Tijdlijn"
        />
      </View>
    </View>
  );
}
