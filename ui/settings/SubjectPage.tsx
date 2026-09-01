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
  runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { duration, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';

/** How far a drag from the left edge must travel to count as going back. */
const BACK_FRACTION = 0.3;
const BACK_VELOCITY = 500;

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
      tx.value = reduceMotion ? 0 : withTiming(0, { duration: duration.base });
      return;
    }
    if (reduceMotion) {
      tx.value = width;
      setMounted(false);
      return;
    }
    tx.value = withTiming(width, { duration: duration.base }, (done) => {
      if (done) runOnJS(setMounted)(false);
    });
  }, [visible, width, reduceMotion, tx]);

  // A drag from the left edge goes back, as it does anywhere else in iOS.
  const swipeBack = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onUpdate((e) => {
      tx.value = Math.max(0, e.translationX);
    })
    .onEnd((e) => {
      const far = e.translationX > width * BACK_FRACTION;
      const fast = e.velocityX > BACK_VELOCITY;
      if (far || fast) runOnJS(onClose)();
      else tx.value = withTiming(0, { duration: duration.fast });
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
