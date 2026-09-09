/**
 * Arranging the blocks on 'Actueel': what is shown, and in what order.
 *
 * A grid of fourteen blocks is not one grower's grid. Some of them measure a
 * greenhouse, some a bulb field, and which three matter enough to be at the top is a
 * question only the reader can answer — so this is where they answer it, and the
 * answer is kept in preferences rather than derived from anything.
 *
 * The drag is `ui/settings/LocationList`'s, deliberately: the two lists are the only
 * reorderable things in the app and they should not be reordered two different ways.
 * A long press lifts the row, the rest slide out of the way to show where it would
 * land, and the move is committed once on release. Rows are a fixed height, which is
 * what turns a drag distance into a slot without measuring anything.
 *
 * ## Hidden blocks stay in the list
 *
 * Switched off, a block dims and keeps its place rather than dropping to a second
 * section. Moving it back on then leaves it where the reader expects, and the list
 * stops being two lists that things jump between — which is the whole reason a
 * "shown / hidden" split reads badly for something people flip back and forth.
 *
 * Turning the last one off is refused, because a grid with nothing in it is a page
 * with nothing to say and no obvious way back.
 */
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { radius, shadowCard, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { Rule } from '../Card';
import { usePrefs } from '../../state/prefs';
import { arrangeAllTiles, reorderTiles, toggleTile, type TileLayout } from '../../core/prefs';
import type { Tile } from '../../core/model/tiles';
import { ta } from '../../core/i18n';

/** Every row is this tall, which is what turns a drag distance into a slot. */
const ROW_HEIGHT = 62;
/** How long a press must be held before the row lifts. Long enough not to fire on a
 *  tap that meant to toggle, short enough not to feel stuck. */
const HOLD_MS = 220;

export interface TileEditorProps {
  visible: boolean;
  onClose: () => void;
  /** Every block the app can draw, in its natural order. */
  all: Tile[];
}

export function TileEditor({ visible, onClose, all }: TileEditorProps) {
  const { palette } = useTheme();
  const { prefs, setTileLayout } = usePrefs();
  const insets = useSafeAreaInsets();

  const layout: TileLayout = prefs.tiles;
  // Hidden blocks included: this list is the arrangement, not the result of it.
  const rows = arrangeAllTiles(all, layout);
  const ids = rows.map((r) => r.id);
  const shown = rows.filter((r) => !layout.hidden.includes(r.id)).length;

  const dragging = useSharedValue(-1);
  const dragY = useSharedValue(0);

  const commit = (from: number, to: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (from !== to) setTileLayout((l) => reorderTiles(l, ids, from, to));
  };

  const toggle = (id: string) => {
    // The last one standing cannot be switched off; see the note at the top.
    if (shown === 1 && !layout.hidden.includes(id)) return;
    Haptics.selectionAsync().catch(() => {});
    setTileLayout((l) => toggleTile(l, id));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
        <View
          style={[
            {
              backgroundColor: palette.appCard,
              borderTopLeftRadius: radius.appCard,
              borderTopRightRadius: radius.appCard,
              paddingBottom: insets.bottom + space[4],
              maxHeight: '88%',
            },
            shadowCard,
          ]}
        >
          <View
            style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: space[5], paddingTop: space[5], paddingBottom: space[4],
            }}
          >
            <Text variant="locationName" color={palette.inkHeading} style={{ flex: 1 }}>
              {ta('editBlocks', prefs.lang)}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10}>
              <Text variant="body" weight="semibold" color={palette.accentDark}>
                {ta('done', prefs.lang)}
              </Text>
            </Pressable>
          </View>

          <Rule />

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ height: ROW_HEIGHT * rows.length, marginTop: space[2] }}>
              {rows.map((tile, i) => (
                <EditorRow
                  key={tile.id}
                  tile={tile}
                  index={i}
                  count={rows.length}
                  hidden={layout.hidden.includes(tile.id)}
                  dragging={dragging}
                  dragY={dragY}
                  onToggle={() => toggle(tile.id)}
                  onCommit={commit}
                />
              ))}
            </View>

            <Text
              variant="caption"
              color={palette.muted}
              style={{ paddingHorizontal: space[5], paddingVertical: space[4] }}
            >
              {ta('editBlocksHint', prefs.lang)}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function EditorRow({
  tile, index, count, hidden, dragging, dragY, onToggle, onCommit,
}: {
  tile: Tile;
  index: number;
  count: number;
  hidden: boolean;
  dragging: { value: number };
  dragY: { value: number };
  onToggle: () => void;
  onCommit: (from: number, to: number) => void;
}) {
  const { palette } = useTheme();

  const drag = Gesture.Pan()
    .enabled(count > 1)
    .activateAfterLongPress(HOLD_MS)
    .onStart(() => {
      dragging.value = index;
      dragY.value = 0;
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
    })
    .onEnd(() => {
      runOnJS(onCommit)(index, target(index, dragY.value, count));
      dragging.value = -1;
      dragY.value = 0;
    });

  const style = useAnimatedStyle(() => {
    const from = dragging.value;
    if (from === index) {
      return { transform: [{ translateY: dragY.value }, { scale: 1.02 }], zIndex: 10 };
    }
    if (from < 0) {
      return { transform: [{ translateY: withTiming(0, { duration: 140 }) }], zIndex: 1 };
    }

    // Make room: every row between where it was and where it is heading steps one
    // slot toward the gap it left behind.
    const to = target(from, dragY.value, count);
    let shift = 0;
    if (from < to && index > from && index <= to) shift = -1;
    else if (from > to && index < from && index >= to) shift = 1;

    return {
      transform: [{ translateY: withSpring(shift * ROW_HEIGHT, { damping: 20, stiffness: 220 }) }],
      zIndex: 1,
    };
  });

  return (
    <Animated.View
      style={[
        { position: 'absolute', left: 0, right: 0, top: index * ROW_HEIGHT, height: ROW_HEIGHT },
        style,
      ]}
    >
      <GestureDetector gesture={drag}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="switch"
          accessibilityState={{ checked: !hidden }}
          accessibilityLabel={`${tile.title}, ${tile.timeLabel}`}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row', alignItems: 'center', gap: space[3],
            paddingHorizontal: space[5],
            backgroundColor: pressed ? palette.surfaceAlt : palette.appCard,
          })}
        >
          <Icon name="dots-six-vertical" size={18} color={palette.inkDisabled} />

          <View style={{ flex: 1, gap: 1 }}>
            {/* A hidden row dims rather than moving: see the note at the top. */}
            <Text
              variant="label"
              color={hidden ? palette.inkDisabled : palette.inkHeading}
              numberOfLines={1}
            >
              {tile.title}
            </Text>
            <Text variant="caption" color={palette.muted} numberOfLines={1}>
              {tile.timeLabel}
            </Text>
          </View>

          <View
            style={{
              width: 22, height: 22, borderRadius: 7,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: hidden ? palette.surfaceAlt : palette.accent,
            }}
          >
            {hidden ? null : <Icon name="check" size={14} color={palette.appCard} weight="bold" />}
          </View>
        </Pressable>
      </GestureDetector>
    </Animated.View>
  );
}

/** Which slot a row dragged `dy` points from `from` lands in. */
function target(from: number, dy: number, count: number): number {
  'worklet';
  const moved = Math.round(dy / ROW_HEIGHT);
  return Math.min(count - 1, Math.max(0, from + moved));
}
