/**
 * The window slider, for when the accumulation curve is folded away.
 *
 * The curve is the control while it is on screen — dragging across it picks the
 * window. Folded down, there is nothing left to drag, so this row stands in its
 * place: a full-sized play button and a track carrying the same six windows.
 *
 * The same arrangement `Timeline` has under the nowcast profile, and the same rule
 * underneath it: something on screen has to be draggable. The two are never visible
 * at once, so neither is a duplicate of the other.
 *
 * The track's ends are labelled rather than every stop. Six signed labels at caption
 * size is a row of digits nobody reads, and what the reader needs from a folded panel
 * is which way is further back.
 */
import { Pressable, View } from 'react-native';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { Scrubber } from './Scrubber';
import { lookbackLabel, type CumulativeWindow } from '../../core/radar/cumulative';

export interface CumulativeTimelineProps {
  /** Shortest first, as the chart's axis runs. */
  windows: readonly CumulativeWindow[];
  index: number;
  onIndexChange: (index: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
}

export function CumulativeTimeline({
  windows, index, onIndexChange, playing, onTogglePlay,
}: CumulativeTimelineProps) {
  const { palette } = useTheme();
  const first = windows[0];
  const last = windows[windows.length - 1];
  const current = windows[index];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <Pressable
        onPress={onTogglePlay}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Opbouw pauzeren' : 'Opbouw afspelen'}
        disabled={windows.length < 2}
        style={{
          width: 42, height: 42, borderRadius: radius.pill,
          backgroundColor: windows.length < 2 ? palette.inkDisabled : palette.accent,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon name={playing ? 'pause' : 'play'} size={18} color="#fff" weight="fill" />
      </Pressable>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text variant="caption" color={palette.muted} tabular>
            {first ? lookbackLabel(first.hours) : ''}
          </Text>
          {/* The window itself, because with the curve gone this is the only place
              that says which one the map is showing. */}
          <Text variant="caption" weight="bold" color={palette.inkHeading} tabular>
            {current ? lookbackLabel(current.hours) : ''}
          </Text>
          <Text variant="caption" color={palette.muted} tabular>
            {last ? lookbackLabel(last.hours) : ''}
          </Text>
        </View>

        <Scrubber
          value={index}
          steps={windows.length}
          onChange={onIndexChange}
          disabled={windows.length < 2}
          accessibilityLabel="Terugkijkperiode"
        />
      </View>
    </View>
  );
}
