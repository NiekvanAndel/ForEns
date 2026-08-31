/**
 * The "you are here" pin with its expanding ring.
 *
 * The design animates this with `@keyframes ec-pulse` — scale .8 to 1.9, opacity 1
 * to 0, over 2.4s. Reanimated reproduces it on the UI thread so the ring keeps
 * timing while the map is being panned.
 *
 * Honours Reduce Motion: the ring is drawn static rather than removed, so the pin
 * still reads the same, it just stops moving.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue,
  withRepeat, withTiming, cancelAnimation,
} from 'react-native-reanimated';
import { duration, shadowFloat, useTheme } from '../../theme';

export function PulsePin({ size = 23 }: { size?: number }) {
  const { palette } = useTheme();
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: duration.pulse, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: 0.8 + progress.value * 1.1 }],
    opacity: 1 - progress.value,
  }));

  const ringInset = -Math.round(size * 0.39);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: ringInset, bottom: ringInset, left: ringInset, right: ringInset,
            borderRadius: size, borderWidth: 2,
            borderColor: 'rgba(12,37,71,.35)',
          },
          reduceMotion ? { opacity: 0.5 } : ring,
        ]}
      />
      <View
        style={[
          {
            width: size, height: size, borderRadius: size / 2,
            backgroundColor: palette.inkHeading,
            borderWidth: 3, borderColor: '#fff',
          },
          shadowFloat,
        ]}
      />
    </View>
  );
}

/** A station pin: white with an AgroExact-green ring, per the design's legend. */
export function StationPin({ size = 15 }: { size?: number }) {
  const { palette } = useTheme();
  return (
    <View
      style={[
        {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: '#fff',
          borderWidth: 3, borderColor: palette.agroBright,
        },
        shadowFloat,
      ]}
    />
  );
}
