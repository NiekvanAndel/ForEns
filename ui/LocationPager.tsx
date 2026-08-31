/**
 * Swipe the page sideways to move between saved locations.
 *
 * The location pills are gone from the top bar, so this is how you change place:
 * the whole page is the control. The dots in the top bar are its position indicator.
 *
 * The gesture waits for 40 points of horizontal travel and gives up on 25 points of
 * vertical, which leaves the page's own scrolling untouched and lets the horizontal
 * hour strips keep their swipes: a native scroll view claims the gesture well before
 * this one activates, so dragging a strip scrolls the strip and dragging the page
 * changes location.
 *
 * The page slides out, the location changes, and the new one slides in from the far
 * side. Under Reduce Motion the change is immediate and nothing moves.
 */
import type { ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { usePrefs } from '../state/prefs';

/** Fraction of the screen a drag must cross to count, if it is not a flick. */
const COMMIT_FRACTION = 0.25;
/** Points per second above which a short drag counts anyway. */
const COMMIT_VELOCITY = 600;
/** How much of the finger's movement the page follows once it is at the end of the
 *  list, so a swipe with nowhere to go feels bounded rather than broken. */
const RUBBER = 0.3;

export function LocationPager({ children }: { children: ReactNode }) {
  const { prefs, selectLocation } = usePrefs();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const count = prefs.locations.length;
  const index = prefs.activeLocation;
  const tx = useSharedValue(0);

  const change = (next: number) => {
    Haptics.selectionAsync().catch(() => {});
    selectLocation(next);
  };

  const pan = Gesture.Pan()
    .enabled(count > 1)
    .activeOffsetX([-40, 40])
    .failOffsetY([-25, 25])
    .onUpdate((e) => {
      tx.value = reduceMotion ? 0 : e.translationX * RUBBER * 2;
    })
    .onEnd((e) => {
      const far = Math.abs(e.translationX) > width * COMMIT_FRACTION;
      const fast = Math.abs(e.velocityX) > COMMIT_VELOCITY;
      if (!far && !fast) {
        tx.value = withSpring(0);
        return;
      }
      // Dragging left moves forward through the list, as a carousel does.
      const dir = e.translationX < 0 ? 1 : -1;
      const next = (index + dir + count) % count;

      if (reduceMotion) {
        tx.value = 0;
        runOnJS(change)(next);
        return;
      }
      tx.value = withTiming(-dir * width * 0.35, { duration: 140 }, (done) => {
        if (!done) return;
        runOnJS(change)(next);
        // Come in from the side the new page arrives from.
        tx.value = dir * width * 0.35;
        tx.value = withSpring(0, { damping: 18, stiffness: 180 });
      });
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>
    </GestureDetector>
  );
}
