/**
 * Swipe the page sideways to move between saved locations.
 *
 * The location pills are gone from the top bar, so this is how you change place:
 * the whole page is the control. The arrow and dots in the top bar are its position
 * indicator.
 *
 * ## Why the neighbours are drawn
 *
 * A swipe used to move one page: the current one slid off, the location changed, and
 * a page slid back in with whatever had loaded by then. The place you were going to
 * only appeared once you had arrived, which is what made the gesture feel like a
 * command rather than a movement.
 *
 * So the pages either side are rendered too, at ∓ one screen, and the whole strip
 * follows the finger — the next location is legible before the swipe is finished,
 * and letting go simply completes a movement already half seen.
 *
 * They are drawn from `cachedModel`, so this only happens for a location the reader
 * has already visited; one that has not been shows an empty page, exactly as it did
 * before. Nothing is fetched for a page sliding past. Each neighbour reads its
 * location and its forecast through the two override providers, so no component had
 * to learn that it might not be the page in front.
 *
 * They are mounted for the duration of the gesture and unmounted after it, because a
 * page is not cheap — 'Nu' holds a map — and two spare copies of one on every screen
 * is a price paid for a gesture that happens occasionally.
 *
 * ## The commit
 *
 * On release the strip travels a whole screen, so the neighbour lands exactly where
 * the active page was. Only then does the selection change, and the offset is reset
 * in an effect once the new page has rendered in its place — resetting it any sooner
 * puts the outgoing page back on screen for a frame.
 *
 * The gesture waits for 18 points of horizontal travel and gives up on 22 points of
 * vertical, which leaves the page's own scrolling untouched and lets the horizontal
 * hour strips keep their swipes: a native scroll view claims the gesture well before
 * this one activates, so dragging a strip scrolls the strip and dragging the page
 * changes location.
 *
 * Under Reduce Motion the change is immediate and nothing moves.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { LocationOverrideProvider, usePrefs } from '../state/prefs';
import { ForecastOverrideProvider, useForecast } from '../state/forecast';

/** Fraction of the screen a drag must cross to count, if it is not a flick. */
const COMMIT_FRACTION = 0.25;
/** Points per second above which a short drag counts anyway. */
const COMMIT_VELOCITY = 500;
/** How much of the finger's movement the page follows when there is nowhere to go. */
const RUBBER = 0.25;
/** Bounds on the travel after release, so a slow drag does not crawl to the edge and
 *  a flick does not snap there. */
const EXIT_MIN_MS = 120;
const EXIT_MAX_MS = 280;

export function LocationPager({ children }: { children: ReactNode }) {
  const { prefs, selectLocation } = usePrefs();
  const { cachedModel } = useForecast();
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const count = prefs.locations.length;
  const index = prefs.activeLocation;
  const tx = useSharedValue(0);
  // Neighbours exist only while a gesture does. See the note above.
  const [dragging, setDragging] = useState(false);

  // Once the new page has rendered where the old one was carried to, the offset can
  // go back to zero without anything moving on screen.
  useEffect(() => {
    tx.value = 0;
    setDragging(false);
  }, [index, tx]);

  const change = (next: number) => {
    Haptics.selectionAsync().catch(() => {});
    selectLocation(next);
  };

  const prevIndex = count > 1 ? (index - 1 + count) % count : index;
  const nextIndex = count > 1 ? (index + 1) % count : index;

  const pan = Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-22, 22])
    .onBegin(() => {
      if (count > 1 && !reduceMotion) runOnJS(setDragging)(true);
    })
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
        tx.value = withSpring(0, { damping: 20, stiffness: 220 }, (done) => {
          if (done) runOnJS(setDragging)(false);
        });
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

      // Carry the throw: the rest of one screen, at the speed it was let go.
      const target = -dir * width;
      const remaining = Math.abs(target - tx.value);
      const speed = Math.max(Math.abs(e.velocityX), 900);
      const ms = Math.min(EXIT_MAX_MS, Math.max(EXIT_MIN_MS, (remaining / speed) * 1000));

      tx.value = withTiming(target, { duration: ms }, (done) => {
        if (done) runOnJS(change)(next);
      });
    })
    // A gesture cancelled by the system leaves the strip wherever it was.
    .onFinalize(() => {
      if (tx.value === 0) runOnJS(setDragging)(false);
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const showNeighbours = dragging && count > 1;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1 }, style]}>
        {showNeighbours ? (
          <Neighbour side="left" width={width} index={prevIndex}>
            {children}
          </Neighbour>
        ) : null}

        <View style={{ flex: 1 }}>{children}</View>

        {showNeighbours ? (
          <Neighbour side="right" width={width} index={nextIndex}>
            {children}
          </Neighbour>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );

  /** One page beside the current one, drawn from the cache or left blank. */
  function Neighbour({
    side, width: w, index: at, children: page,
  }: { side: 'left' | 'right'; width: number; index: number; children: ReactNode }) {
    const location = prefs.locations[at];
    const model = location ? cachedModel(location.lat, location.lon) : null;
    const frame = {
      position: 'absolute' as const,
      top: 0,
      bottom: 0,
      width: w,
      [side]: -w,
      backgroundColor: palette.appBg,
    };

    // Nothing loaded for that place yet: an empty page, rather than a torn edge or a
    // fetch nobody asked for.
    if (!location || !model) return <View style={frame} pointerEvents="none" />;

    return (
      <View style={frame} pointerEvents="none">
        <LocationOverrideProvider location={location}>
          <ForecastOverrideProvider model={model} alert={null}>
            {page}
          </ForecastOverrideProvider>
        </LocationOverrideProvider>
      </View>
    );
  }
}
