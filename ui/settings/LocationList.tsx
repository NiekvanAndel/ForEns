/**
 * The saved locations, reorderable by dragging.
 *
 * The order matters — it is the order the page swipe walks through — and it used to
 * be changed with an up and a down arrow per row: two taps to move a place two
 * slots, four to move it four, with the list jumping under your finger each time.
 * Picking the row up and putting it where it belongs is one gesture, and it shows
 * you the arrangement you are about to get while you are still deciding.
 *
 * A long press starts the drag, not a touch: a plain touch on a row selects that
 * location, and a list where holding still for a moment is the only way to avoid
 * moving something is a list you cannot browse. The grip on the left says the row
 * moves; anywhere on the row works, because a 20-point target for a drag is a
 * target that gets missed.
 *
 * Rows are a fixed height so a drag can be turned into a slot without measuring
 * anything: how far the finger has travelled, over the height of a row, is how many
 * places the row has moved. Everything else slides out of the way to show where it
 * would land, and the reorder is committed once — on release — rather than on every
 * crossing, so the list under the finger never renumbers mid-drag.
 *
 * The device's own location cannot be moved or deleted. It is not a place you saved;
 * it is where you are, and it is always the first page.
 */
import { View, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { radius, shadowCard, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';
import type { SavedLocation } from '../../core/prefs';

/** Every row is this tall, which is what turns a drag distance into a slot. */
const ROW_HEIGHT = 62;
/** How long a press must be held before the row lifts. Long enough not to fire on a
 *  tap that meant to select, short enough not to feel stuck. */
const HOLD_MS = 220;

export function LocationList() {
  const { palette } = useTheme();
  const { prefs, selectLocation, removeLocation, reorderLocation } = usePrefs();
  const locations = prefs.locations;

  // Which row is in the air, and how far it has been carried. Shared, because every
  // row reads them to decide where it should sit.
  const dragging = useSharedValue(-1);
  const dragY = useSharedValue(0);

  const commit = (from: number, to: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (from !== to) reorderLocation(from, to);
  };

  // No card of its own: this lives inside a `Group`, which is the card.
  return (
    <View>
      <View style={{ height: ROW_HEIGHT * locations.length }}>
        {locations.map((l, i) => (
          <LocationRow
            key={`${l.name}-${l.lat}-${l.lon}`}
            location={l}
            index={i}
            count={locations.length}
            dragging={dragging}
            dragY={dragY}
            onSelect={() => selectLocation(i)}
            onRemove={() => removeLocation(i)}
            onCommit={commit}
            canRemove={locations.length > 1 && !l.current}
            selected={i === prefs.activeLocation}
          />
        ))}
      </View>
      {locations.length > 1 ? (
        <Text
          variant="caption"
          color={palette.muted}
          style={{ paddingHorizontal: space[5], paddingVertical: space[3] }}
        >
          {ta('reorderHint', prefs.lang)}
        </Text>
      ) : null}
    </View>
  );
}

function LocationRow({
  location, index, count, dragging, dragY, onSelect, onRemove, onCommit, canRemove, selected,
}: {
  location: SavedLocation;
  index: number;
  count: number;
  dragging: { value: number };
  dragY: { value: number };
  onSelect: () => void;
  onRemove: () => void;
  onCommit: (from: number, to: number) => void;
  canRemove: boolean;
  selected: boolean;
}) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  // The device's page is always first, so it neither moves nor makes room.
  const fixed = !!location.current;

  const drag = Gesture.Pan()
    .enabled(count > 1 && !fixed)
    .activateAfterLongPress(HOLD_MS)
    .onStart(() => {
      dragging.value = index;
      dragY.value = 0;
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
    })
    .onEnd(() => {
      const to = target(index, dragY.value, count, fixed);
      runOnJS(onCommit)(index, to);
      dragging.value = -1;
      dragY.value = 0;
    });

  const style = useAnimatedStyle(() => {
    const from = dragging.value;
    const lifted = from === index;

    if (lifted) {
      return {
        transform: [{ translateY: dragY.value }, { scale: 1.02 }],
        zIndex: 10,
        opacity: 1,
      };
    }
    if (from < 0) {
      return { transform: [{ translateY: withTiming(0, { duration: 140 }) }], zIndex: 1, opacity: 1 };
    }

    // Make room: every row between where it was and where it is heading steps one
    // slot toward the gap it left behind.
    const to = target(from, dragY.value, count, false);
    let shift = 0;
    if (from < to && index > from && index <= to) shift = -1;
    else if (from > to && index < from && index >= to) shift = 1;

    return {
      transform: [{ translateY: withSpring(shift * ROW_HEIGHT, { damping: 20, stiffness: 220 }) }],
      zIndex: 1,
      opacity: 1,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute', left: 0, right: 0,
          top: index * ROW_HEIGHT, height: ROW_HEIGHT,
        },
        style,
      ]}
    >
      <GestureDetector gesture={drag}>
        <Pressable
          onPress={onSelect}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={location.name}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row', alignItems: 'center', gap: space[3],
            paddingHorizontal: space[5],
            borderBottomWidth: index === count - 1 ? 0 : 1,
            borderBottomColor: palette.hairlineSoft,
            borderRadius: radius.tile,
            backgroundColor: pressed ? palette.pressedRow : palette.appCard,
          })}
        >
          <View style={{ width: 20 }}>
            <Icon
              name={fixed ? 'navigation-arrow' : 'dots-six-vertical'}
              size={fixed ? 16 : 20}
              color={palette.muted}
              weight={fixed ? 'fill' : 'regular'}
            />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              variant="bodySm"
              weight="semibold"
              numberOfLines={1}
              // Green names a station, never a place — design rule 1.
              color={location.stationId ? palette.agroInk : palette.inkHeading}
            >
              {location.name}
            </Text>
            <Text variant="caption" color={palette.muted} numberOfLines={1}>
              {location.stationName ?? location.sub ?? (fixed ? ta('useMyLocation', prefs.lang) : '')}
            </Text>
          </View>

          {selected ? (
            <Icon name="check" size={15} color={palette.accentDark} weight="bold" />
          ) : null}

          {canRemove ? (
            <Pressable
              onPress={onRemove}
              accessibilityRole="button"
              accessibilityLabel="Verwijderen"
              hitSlop={8}
              style={{ padding: 2 }}
            >
              <Icon name="trash" size={17} color={palette.valHigh} />
            </Pressable>
          ) : null}
        </Pressable>
      </GestureDetector>
    </Animated.View>
  );
}

/**
 * Which slot a row carried this far would land in.
 *
 * A worklet as well as an ordinary function: the row being dragged calls it on the
 * UI thread to place its neighbours, and the gesture calls it on release to commit.
 */
function target(from: number, dy: number, count: number, fixedFirst: boolean): number {
  'worklet';
  const moved = Math.round(dy / ROW_HEIGHT);
  const lowest = fixedFirst ? 1 : 0;
  return Math.min(count - 1, Math.max(lowest, from + moved));
}
