/**
 * One block on 'Actueel', for every saved location.
 *
 * The grid answers "what is it doing here". This answers the question a grower asks
 * next and cannot ask of a grid: is it colder at Biggekerke than at Libeek, and by
 * how much. Same block, same window, one row per place — which is only a comparison
 * if every row is computed the same way, so all of them come from
 * `useAllLocationConditions` and through the same `modelTiles` the grid behind uses.
 *
 * Sorted highest first, with the places that have no answer at the bottom. A wind
 * *direction* keeps the reader's own order instead: 350° is not more than 10°, and
 * sorting compass bearings by their degrees would put north at both ends of the list.
 *
 * The station dot is per row and means what it means everywhere else — an instrument
 * reported this. Two rows can differ in that, and on this sheet especially they
 * should be readable apart: a measured 16,5° and a modelled 16,5° are not the same
 * claim, and the whole sheet is about putting numbers beside each other.
 *
 * Rows appear as their locations land rather than all at once. Each is its own
 * request, so one slow place holds up its own row and not the sheet.
 */
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, shadowCard, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Rule } from '../Card';
import { usePrefs } from '../../state/prefs';
import { useAllLocationConditions } from '../../state/allLocations';
import { modelTiles, type Tile, type TileLabels } from '../../core/model/tiles';
import { ta } from '../../core/i18n';
import { tileReading } from './ConditionTile';

export interface TileSheetProps {
  /** The block to compare, or null when the sheet is shut. */
  tile: Tile | null;
  labels: TileLabels;
  onClose: () => void;
}

interface Row {
  name: string;
  /** Null where that location has no answer for this block. */
  value: number | null;
  measured: boolean;
  loading: boolean;
}

export function TileSheet({ tile, labels, onClose }: TileSheetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();
  // Nothing is fetched until the sheet is actually open.
  const conditions = useAllLocationConditions(tile != null);

  const rows: Row[] = conditions.map(({ location, model, loading }) => {
    // The same twelve blocks the grid behind is drawing, for this location; the one
    // being compared is picked out by id, so the two cannot describe different
    // windows of the same quantity.
    const match = model ? modelTiles(model, labels).find((t) => t.id === tile?.id) : undefined;
    return {
      name: location.name,
      value: match?.value ?? null,
      measured: match?.measured ?? false,
      loading,
    };
  });

  const sorted =
    tile?.kind === 'direction'
      ? rows
      : [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));

  return (
    <Modal
      visible={tile != null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={ta('done', prefs.lang)}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
      >
        {/* Swallows the press, so tapping the sheet does not dismiss it. */}
        <Pressable
          onPress={() => {}}
          style={[
            {
              backgroundColor: palette.appCard,
              borderTopLeftRadius: radius.appCard,
              borderTopRightRadius: radius.appCard,
              paddingBottom: insets.bottom + space[4],
              maxHeight: '80%',
            },
            shadowCard,
          ]}
        >
          <View style={{ alignItems: 'center', paddingTop: space[3], paddingBottom: space[2] }}>
            <View
              style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: palette.hairline }}
            />
          </View>

          <View style={{ paddingHorizontal: space[5], paddingBottom: space[4], gap: 2 }}>
            <Text variant="locationName" color={palette.inkHeading} numberOfLines={2}>
              {tile?.title ?? ''}
            </Text>
            <Text variant="caption" color={palette.muted}>
              {tile?.timeLabel ?? ''}
            </Text>
          </View>

          <Rule />

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: space[5] }}
            showsVerticalScrollIndicator={false}
          >
            {sorted.map((row, i) => (
              <View
                key={`${row.name}-${i}`}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: space[3],
                  paddingVertical: 14,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: palette.hairlineSoft,
                }}
              >
                {row.measured ? (
                  <View
                    style={{
                      width: 7, height: 7, borderRadius: 3.5,
                      backgroundColor: palette.agroBright,
                    }}
                  />
                ) : null}
                <Text
                  variant="label"
                  color={palette.inkHeading}
                  numberOfLines={1}
                  style={{ flexShrink: 1, flexGrow: 1 }}
                >
                  {row.name}
                </Text>
                <Reading row={row} tile={tile} />
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** One location's answer, in the reader's own units. */
function Reading({ row, tile }: { row: Row; tile: Tile | null }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  if (!tile) return null;

  // A location still loading gets an ellipsis rather than a dash: the two mean
  // different things, and a dash that later becomes a number reads as a correction.
  if (row.loading && row.value == null) {
    return (
      <Text variant="label" color={palette.inkDisabled}>
        …
      </Text>
    );
  }

  const { value, unit } = tileReading({ ...tile, value: row.value }, prefs);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
      <Text
        variant="stat"
        color={row.value == null ? palette.muted : palette.appValue}
        tabular
        style={{ fontSize: 17 }}
      >
        {value}
      </Text>
      {unit ? (
        <Text variant="caption" weight="semibold" color={palette.muted} style={{ fontSize: 11.5 }}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}
