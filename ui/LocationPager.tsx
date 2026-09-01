/**
 * Swipe the page sideways to move between saved locations.
 *
 * The location pills are gone from the top bar, so this is how you change place:
 * the whole page is the control. The arrow and dots in the top bar are its position
 * indicator.
 *
 * ## Why it follows the finger
 *
 * It used to move the page at 0.6× the finger and, on release, slide a third of a
 * screen out, swap, and spring back — so the page lagged under the thumb and the
 * change arrived as a shove rather than as a page you had dragged. Now the page
 * tracks the finger point for point, leaves at the speed it was thrown, and the next
 * one arrives from the far edge carrying the same motion. There is nothing to render
 * behind the drag — one location's data is loaded at a time — so the page it hands
 * over to fades in over the last few points of travel rather than appearing at once.
 *
 * Rubber-banding is kept for the one case that has nowhere to go: a single saved
 * location, where a swipe should feel bounded rather than broken.
 *
 * The gesture waits for 18 points of horizontal travel and gives up on 22 points of
 * vertical, which leaves the page's own scrolling untouched and lets the horizontal
 * hour strips keep their swipes: a native scroll view claims the gesture well before
 * this one activates, so dragging a strip scrolls the strip and dragging the page
 * changes location.
 *
 * Under Reduce Motion the change is immediate and nothing moves.
 */
import type { ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming,
  interpolate, Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { usePrefs } from '../state/prefs';

/** Fraction of the screen a drag must cross to count, if it is not a flick. */
const COMMIT_FRACTION = 0.25;
/** Points per second above which a short drag counts anyway. */
const COMMIT_VELOCITY = 500;
/** How much of the finger's movement the page follows when there is nowhere to go. */
const RUBBER = 0.25;
/** How far the outgoing page travels before the swap, as a fraction of the screen.
 *  Short of a full width: past this the page is off screen and its last points of
 *  travel are time spent looking at nothing. */
const EXIT_FRACTION = 0.55;
/** Bounds on the exit, so a slow drag does not crawl and a flick does not snap. */
const EXIT_MIN_MS = 90;
const EXIT_MAX_MS = 220;

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
    .activeOffsetX([-18, 18])
    .failOffsetY([-22, 22])
    .onUpdate((e) => {
      if (reduceMotion) return;
      // Point for point while there is somewhere to go; damped when there is not.
      tx.value = count > 1 ? e.translationX : e.translationX * RUBBER;
    })
    .onEnd((e) => {
      if (count < 2) {
        tx.value = withSpring(0, { damping: 20, stiffness: 220 });
        return;
      }
      const far = Math.abs(e.translationX) > width * COMMIT_FRACTION;
      const fast = Math.abs(e.velocityX) > COMMIT_VELOCITY;
      if (!far && !fast) {
        tx.value = withSpring(0, { damping: 20, stiffness: 220 });
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

      // Carry the throw: what is left of the exit, at the speed it was let go.
      const exit = -dir * width * EXIT_FRACTION;
      const remaining = Math.abs(exit - tx.value);
      const speed = Math.max(Math.abs(e.velocityX), 800);
      const ms = Math.min(EXIT_MAX_MS, Math.max(EXIT_MIN_MS, (remaining / speed) * 1000));

      tx.value = withTiming(exit, { duration: ms }, (done) => {
        if (!done) return;
        runOnJS(change)(next);
        // The new page arrives from the side the swipe was heading toward.
        tx.value = dir * width * EXIT_FRACTION;
        tx.value = withSpring(0, { damping: 22, stiffness: 200 });
      });
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    // Fades out as it leaves and back in as it arrives, which is what covers the
    // moment the content underneath is replaced.
    opacity: interpolate(
      Math.abs(tx.value),
      [0, width * EXIT_FRACTION],
      [1, 0.35],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>
    </GestureDetector>
  );
}
