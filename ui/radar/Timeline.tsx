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
 * ## What is left here, and where it is shown
 *
 * Play and pause moved up beside the location name in `NowcastPanel`, and the timer
 * that drives them moved into `useRadarFrames` — whoever owns the index owns the
 * clock. What is left is the track, which is pure presentation.
 *
 * It is not on screen most of the time. The chart above is the scrubber wherever
 * there is a curve to drag: one control, read and moved in the same place. This row
 * appears only where that curve is not there to be dragged — folded away on the map
 * page, or absent on a location the nowcast has nothing to say about. Two causes,
 * one rule: something on screen has to be draggable.
 */
import { View } from 'react-native';
import { Scrubber } from './Scrubber';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import { forecastBoundary, frameClock, type RadarFrame } from '../../core/radar';

export interface TimelineProps {
  frames: RadarFrame[];
  index: number;
  onIndexChange: (i: number) => void;
  /** The from/at/to row above the slider. */
  showLabels?: boolean;
  /** Where each frame sits on the track, 0–1, when a chart above shares the axis. */
  stepPositions?: readonly number[];
}

export function Timeline({
  frames, index, onIndexChange, showLabels = true, stepPositions,
}: TimelineProps) {
  const { palette } = useTheme();
  const last = Math.max(0, frames.length - 1);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
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
