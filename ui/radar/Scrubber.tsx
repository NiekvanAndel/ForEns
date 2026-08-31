/**
 * The timeline scrubber.
 *
 * Built from gesture-handler and Reanimated rather than a slider package: both are
 * already in the project and version-locked by the Expo SDK, and the design's track
 * — a hairline rail with an accent fill, a tick at the observed/forecast boundary
 * and a shadowed thumb — is not something a stock slider styles cleanly anyway.
 *
 * Dragging runs entirely on the UI thread, so scrubbing stays smooth while the map
 * swaps tile overlays underneath.
 */
import { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { shadowFloat, useTheme } from '../../theme';

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 22;

export interface ScrubberProps {
  /** Current step, 0-based. */
  value: number;
  /** Number of steps; the maximum value is `steps - 1`. */
  steps: number;
  onChange: (index: number) => void;
  /** Fraction 0–1 at which to draw the observed/forecast divider. */
  markerFraction?: number | null;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function Scrubber({
  value, steps, onChange, markerFraction, disabled, accessibilityLabel,
}: ScrubberProps) {
  const { palette } = useTheme();
  const [width, setWidth] = useState(0);
  const dragging = useSharedValue(0);
  const last = Math.max(1, steps - 1);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  /** Position for a step, in points, clamped so the thumb never leaves the track. */
  const usable = Math.max(0, width - THUMB_SIZE);
  const x = steps > 1 ? (value / last) * usable : 0;

  const emit = useCallback(
    (px: number) => {
      if (disabled || steps < 2 || usable <= 0) return;
      const fraction = Math.min(1, Math.max(0, px / usable));
      const next = Math.round(fraction * last);
      if (next !== value) onChange(next);
    },
    [disabled, steps, usable, last, value, onChange]
  );

  const pan = Gesture.Pan()
    .enabled(!disabled && steps > 1)
    .onBegin((e) => {
      dragging.value = withTiming(1, { duration: 120 });
      runOnJS(emit)(e.x - THUMB_SIZE / 2);
    })
    .onUpdate((e) => {
      runOnJS(emit)(e.x - THUMB_SIZE / 2);
    })
    .onFinalize(() => {
      dragging.value = withTiming(0, { duration: 160 });
    });

  // Tapping anywhere on the track jumps to that step, which is how a timeline is
  // expected to behave; without it only the thumb would be draggable.
  const tap = Gesture.Tap()
    .enabled(!disabled && steps > 1)
    .onEnd((e) => {
      runOnJS(emit)(e.x - THUMB_SIZE / 2);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + dragging.value * 0.15 }],
  }));

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <View
        onLayout={onLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: last, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (disabled) return;
          if (e.nativeEvent.actionName === 'increment') onChange(Math.min(last, value + 1));
          if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(0, value - 1));
        }}
        // A tall hit area over a thin track: the rail is 6pt, a finger is not.
        style={{ height: 40, justifyContent: 'center' }}
      >
        <View
          style={{
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            backgroundColor: palette.hairline,
            marginHorizontal: THUMB_SIZE / 2,
            overflow: 'visible',
          }}
        >
          <View
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: Math.max(0, x),
              borderRadius: TRACK_HEIGHT / 2,
              backgroundColor: disabled ? palette.inkDisabled : palette.accent,
            }}
          />

          {markerFraction != null ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: `${markerFraction * 100}%`,
                top: -3, bottom: -3, width: 2, borderRadius: 1,
                backgroundColor: palette.muted,
                opacity: 0.55,
              }}
            />
          ) : null}
        </View>

        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: x,
              width: THUMB_SIZE, height: THUMB_SIZE,
              borderRadius: THUMB_SIZE / 2,
              backgroundColor: '#fff',
              borderWidth: 2,
              borderColor: disabled ? palette.inkDisabled : palette.accent,
            },
            shadowFloat,
            thumbStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}
