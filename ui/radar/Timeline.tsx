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
 * Play and pause used to sit here, at the head of the row. It has moved up beside
 * the location name in `NowcastPanel`: this row is one control, and a button glued
 * to the end of a track reads as part of the track. Up there it sits with the other
 * thing the panel says about the loop as a whole, and the track gets the full width
 * — which is what a scrubber wants, since its precision is its length.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import { Scrubber } from './Scrubber';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import { forecastBoundary, frameClock, type RadarFrame } from '../../core/radar';

/** One step per this many milliseconds during playback, matching the design's 450ms. */
export const PLAY_INTERVAL_MS = 450;

export interface TimelineProps {
  frames: RadarFrame[];
  index: number;
  /** Whether the loop is running — the interval lives here, the button does not. */
  playing: boolean;
  onIndexChange: (i: number) => void;
  /** The from/at/to row above the slider. */
  showLabels?: boolean;
  /** Where each frame sits on the track, 0–1, when a chart above shares the axis. */
  stepPositions?: readonly number[];
}

export function Timeline({
  frames, index, playing, onIndexChange, showLabels = true, stepPositions,
}: TimelineProps) {
  const { palette } = useTheme();
  const last = Math.max(0, frames.length - 1);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const id = setInterval(() => onIndexChange((index + 1) % frames.length), PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, index, frames.length, onIndexChange]);

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
