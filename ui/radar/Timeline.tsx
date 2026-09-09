/**
 * The radar timeline: a scrubber across the frames.
 *
 * The design's slider runs "nu · +1 uur · +2 uur", but a real frame list is not
 * evenly split that way — the ExactCast run is a quarter of an hour of observation
 * and an hour and a half of forecast. So the labels are derived from the frames
 * themselves rather than hard-coded, and the "now" boundary is marked, since the
 * difference between observed and forecast radar is the thing a reader most needs
 * to see.
 *
 * `showLabels` turns that row off where a chart above the slider already carries
 * the time axis — three more timestamps under it would be the same information
 * twice, in a place where height is what the map wants.
 *
 * ## Where this row is shown, and what it carries
 *
 * Not on screen most of the time. The chart above is the scrubber wherever there is
 * a curve to drag: one control, read and moved in the same place. This row appears
 * only where that curve is not there to be dragged — folded away on the map page, or
 * absent on a location the nowcast has nothing to say about. Two causes, one rule:
 * something on screen has to be draggable.
 *
 * Play and pause are optional here, and they belong to whichever of the two controls
 * is actually on screen. The panel's header carries a small one beside the location
 * name while the curve is up; on the map page, where the header folds away with the
 * curve, this row carries a full-sized one at its head instead. They are never both
 * visible, so neither is a duplicate of the other.
 *
 * The timer that steps the loop is in `useRadarFrames` rather than here — whoever
 * owns the index owns the clock, and this row is not always mounted to keep one.
 */
import { Pressable, View } from 'react-native';
import { Scrubber } from './Scrubber';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { forecastBoundary, frameClock, type RadarFrame } from '../../core/radar';

export interface TimelineProps {
  frames: RadarFrame[];
  index: number;
  onIndexChange: (i: number) => void;
  /** A full-sized play button at the head of the row. Omitted where the panel's own
   *  header is on screen and already carries one. */
  playing?: boolean;
  onTogglePlay?: () => void;
  /** The from/at/to row above the slider. */
  showLabels?: boolean;
  /** Where each frame sits on the track, 0–1, when a chart above shares the axis. */
  stepPositions?: readonly number[];
}

export function Timeline({
  frames, index, onIndexChange, showLabels = true, stepPositions,
  playing, onTogglePlay,
}: TimelineProps) {
  const { palette } = useTheme();
  const last = Math.max(0, frames.length - 1);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      {onTogglePlay ? (
        <Pressable
          onPress={onTogglePlay}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Animatie pauzeren' : 'Animatie afspelen'}
          disabled={frames.length < 2}
          style={{
            width: 42, height: 42, borderRadius: radius.pill,
            backgroundColor: frames.length < 2 ? palette.inkDisabled : palette.accent,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name={playing ? 'pause' : 'play'} size={18} color="#fff" weight="fill" />
        </Pressable>
      ) : null}

      <View style={{ flex: 1 }}>
        {showLabels ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text variant="caption" color={palette.muted} tabular>
              {frameClock(frames[0])}
            </Text>
            <Text variant="caption" weight="bold" color={palette.inkHeading} tabular>
              {frameClock(frames[index])}
            </Text>
            <Text variant="caption" color={palette.muted} tabular>
              {frameClock(frames[last])}
            </Text>
          </View>
        ) : null}

        <Scrubber
          value={index}
          steps={frames.length}
          onChange={onIndexChange}
          markerFraction={forecastBoundary(frames, stepPositions)}
          stepPositions={stepPositions}
          disabled={frames.length < 2}
          accessibilityLabel="Tijdlijn"
        />
      </View>
    </View>
  );
}
