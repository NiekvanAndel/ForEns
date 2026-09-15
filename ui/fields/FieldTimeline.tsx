/**
 * The field loop's timeline: a play button and a track across the frames.
 *
 * `Timeline` next door does the same job for the radar, and is not reused: it is typed
 * to `RadarFrame` and it marks the observed/forecast boundary, which is the one thing
 * this loop does not have. Everything here is observation. What the two do share is
 * `Scrubber`, which is the control itself — so the thumb, the rail and the drag behave
 * identically whichever layer is up, and only the labels differ.
 *
 * Three clocks: the oldest frame, the one on screen, the newest. The map used to carry
 * the middle one in a badge of its own, which meant reading the time in one corner and
 * setting it in another; with the badge gone this row is the only place that says which
 * moment is drawn, and it says it directly above the thumb that chose it.
 *
 * Clock times rather than "1,8 uur terug": a reader comparing this with anything else —
 * a forecast row, their own memory of the evening — is comparing times of day, and
 * arithmetic they have to do themselves is arithmetic they will get wrong.
 */
import { Pressable, View } from 'react-native';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { Scrubber } from '../radar/Scrubber';
import { frameClock, type FieldFrame } from '../../core/fields';

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
  const current = frames[index];
  const oldest = frames[0];
  const newest = frames[frames.length - 1];

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
            {oldest ? frameClock(oldest) : ''}
          </Text>
          <Text variant="caption" weight="bold" color={palette.inkHeading} tabular>
            {current ? frameClock(current) : ''}
          </Text>
          <Text variant="caption" color={palette.muted} tabular>
            {newest ? frameClock(newest) : ''}
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
