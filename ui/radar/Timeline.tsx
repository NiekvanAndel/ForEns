/**
 * The radar timeline: play/pause and a scrubber across the frames.
 *
 * The design's slider runs "nu · +1 uur · +2 uur", but a real frame list is not
 * evenly split that way — RainViewer returns roughly two hours of past frames and
 * half an hour of forecast. So the labels are derived from the frames themselves
 * rather than hard-coded, and the "now" boundary is marked, since the difference
 * between observed and forecast radar is the thing a reader most needs to see.
 */
import { useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { Scrubber } from './Scrubber';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { frameLabel, type RadarFrame } from '../../core/radar';

/** One step per this many milliseconds during playback, matching the design's 450ms. */
export const PLAY_INTERVAL_MS = 450;

export interface TimelineProps {
  frames: RadarFrame[];
  index: number;
  playing: boolean;
  onIndexChange: (i: number) => void;
  onTogglePlay: () => void;
}

export function Timeline({ frames, index, playing, onIndexChange, onTogglePlay }: TimelineProps) {
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text variant="caption" color={palette.muted} tabular>
            {frameLabel(frames[0])}
          </Text>
          <Text variant="caption" weight="bold" color={palette.inkHeading} tabular>
            {frameLabel(frames[index])}
          </Text>
          <Text variant="caption" color={palette.muted} tabular>
            {frameLabel(frames[last])}
          </Text>
        </View>

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
