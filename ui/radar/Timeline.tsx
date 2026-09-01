/**
 * The radar timeline: play/pause and a scrubber across the frames.
 *
 * The design's slider runs "nu · +1 uur · +2 uur", but a real frame list is not
 * evenly split that way — RainViewer returns roughly two hours of past frames and
 * half an hour of forecast. So the labels are derived from the frames themselves
 * rather than hard-coded, and the "now" boundary is marked, since the difference
 * between observed and forecast radar is the thing a reader most needs to see.
 *
 * `showLabels` turns that row off where a chart above the slider already carries
 * the time axis — three more timestamps under it would be the same information
 * twice, in a place where height is what the map wants.
 */
import { useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { Scrubber } from './Scrubber';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { frameClock, type RadarFrame } from '../../core/radar';

/** One step per this many milliseconds during playback, matching the design's 450ms. */
export const PLAY_INTERVAL_MS = 450;

export interface TimelineProps {
  frames: RadarFrame[];
  index: number;
  playing: boolean;
  onIndexChange: (i: number) => void;
  onTogglePlay: () => void;
  /** The from/at/to row above the slider. */
  showLabels?: boolean;
}

export function Timeline({
  frames, index, playing, onIndexChange, onTogglePlay, showLabels = true,
}: TimelineProps) {
  const { palette } = useTheme();
  const last = Math.max(0, frames.length - 1);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const id = setInterval(() => onIndexChange((index + 1) % frames.length), PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, index, frames.length, onIndexChange]);

  const firstForecast = frames.findIndex((f) => f.forecast);
  const nowFraction = firstForecast > 0 ? firstForecast / last : null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
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
          markerFraction={nowFraction}
          disabled={frames.length < 2}
          accessibilityLabel="Tijdlijn"
        />
      </View>
    </View>
  );
}
