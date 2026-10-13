/**
 * One subject's settings, pushed over the index.
 *
 * It arrives from the right and leaves to the right, the way a navigation stack
 * moves — not up from the bottom. The direction is the meaning: a sheet says "a
 * detour, dismiss it when you are done", a push says "you have gone one level
 * deeper into the same subject, and back is where you came from". These pages nest
 * two deep, and two sheets stacked from the bottom read as two unrelated detours
 * rather than as a path.
 *
 * It is still a `Modal` underneath, because settings is a tab: a router stack inside
 * one would put a second back-affordance beside the tab bar. So the modal does no
 * animating of its own and the page's own transform does all of it, which is also
 * what lets a drag from the left edge take the page back with it.
 *
 * The page stays mounted through its exit, or the content would vanish before the
 * animation that is supposed to carry it off screen had run.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '../../theme';
import { shouldCommit, spring } from '../../core/motion';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';

/** How far the projected end of a drag from the left edge must reach to count as
 *  going back. */
const BACK_FRACTION = 0.3;

export function SubjectPage({
  visible, title, onClose, children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // Held open through the exit animation, so the page slides off rather than
  // blinking out from under it.
  const [mounted, setMounted] = useState(visible);
  const tx = useSharedValue(width);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      tx.value = reduceMotion ? 0 : withSpring(0, spring.settle);
      return;
    }
    if (reduceMotion) {
      tx.value = width;
      setMounted(false);
      return;
    }
    tx.value = withSpring(width, { ...spring.carry }, (done) => {
      if (done) runOnJS(setMounted)(false);
    });
  }, [visible, width, reduceMotion, tx]);

  // A drag from the left edge goes back, as it does anywhere else in iOS.
  // The page is a spring, so a grab mid-flight starts from where it is on screen
  // (`start`), not from where it was heading.
  const start = useSharedValue(0);
  const swipeBack = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onStart(() => {
      start.value = tx.value;
    })
    .onUpdate((e) => {
      tx.value = Math.max(0, start.value + e.translationX);
    })
    .onEnd((e) => {
      if (shouldCommit(tx.value, e.velocityX, width * BACK_FRACTION)) {
        // The exit effect carries the page off at the finger's speed.
        tx.value = withSpring(width, { ...spring.carry, velocity: e.velocityX });
        runOnJS(onClose)();
      } else {
        tx.value = withSpring(0, { ...spring.settle, velocity: e.velocityX });
      }
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  return (
    <Modal
      visible={mounted}
      animationType="none"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onClose}
    >
      <Animated.View style={[{ flex: 1, backgroundColor: palette.appBg }, style]}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space[2],
            paddingHorizontal: space[4],
            paddingTop: insets.top + space[3],
            paddingBottom: space[3],
          }}
        >
          {/* Back, not close: the chevron points the way the page will leave. */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={ta('back', prefs.lang)}
            hitSlop={12}
            style={({ pressed }) => ({
              width: 34, height: 34, borderRadius: 17,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: pressed ? palette.pressedRow : 'transparent',
            })}
          >
            <Icon name="caret-left" size={20} color={palette.accentDark} weight="bold" />
          </Pressable>
          <Text variant="screenTitle" color={palette.inkHeading} style={{ flex: 1 }}>
            {title}
          </Text>
        </View>

        {/* The edge grab lives beside the content, not around it, so a horizontal
            drag inside a row or a slider is still the row's to handle. */}
        <GestureDetector gesture={swipeBack}>
          <View
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, zIndex: 2 }}
          />
        </GestureDetector>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space[5],
            paddingBottom: insets.bottom + space[10],
            gap: space[6],
          }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
