/**
 * One block on 'Actueel'.
 *
 * Three lines: what it is, what it reads, and over which window. That order is the
 * one the web app's dashboard uses and the one a grid wants — the reader scans the
 * titles to find the block, then drops to the number.
 *
 * The value is converted here rather than upstream, because "18°" is a reader's
 * preference and 18 is a fact. `core/model/tiles` hands over the app's own internal
 * units — °C, km/h, mm — and every tile turns those into whatever the reader asked
 * for at the moment it draws, exactly as the conditions hero and the day rows do.
 * Which is also why the unit is not carried on the tile: the quantity decides it,
 * and the quantity is what `kind` names.
 *
 * A measured block carries the station dot. Design rule 1: green names a station,
 * never a place — and on this page half the blocks can be an instrument's reading
 * and half a model's, sometimes on the same location, so the dot is doing real work
 * rather than decorating.
 *
 * A block with no answer prints a dash and keeps its place. The grid is a layout
 * someone chose; reflowing it because one sensor is quiet would move every block
 * under it.
 *
 * Every block is a button: it opens the same block for every saved location, which
 * is the question a grid cannot answer. There is no caret on it — twelve carets in
 * a grid this dense is a pattern, not an affordance — so the press feedback is what
 * says it is pressable, and the sheet is one tap away from being discovered.
 */
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { space, useTheme } from '../../theme';
import { Card } from '../Card';
import { Text } from '../Text';
import { usePrefs } from '../../state/prefs';
import type { Tile } from '../../core/model/tiles';
import { temperatureColor } from '../../core/model/temperatureColor';
import {
  degToCompass, fmtMm, fmtTempValue, fmtWindValue, windUnitLabel,
} from '../../core/i18n';

/** The reading and the unit it is printed in, in the reader's own units. */
export function tileReading(
  tile: Tile,
  units: { tempUnit: 'C' | 'F' | 'K'; windUnit: 'kmh' | 'ms' | 'kn' | 'bft' }
): { value: string; unit: string } {
  if (tile.value == null) return { value: '—', unit: '' };
  switch (tile.kind) {
    case 'temp':
      return { value: fmtTempValue(tile.value, units.tempUnit), unit: '°' };
    case 'wind':
      return { value: fmtWindValue(tile.value, units.windUnit), unit: windUnitLabel(units.windUnit) };
    case 'mm':
      return { value: fmtMm(tile.value), unit: 'mm' };
    case 'percent':
      return { value: String(Math.round(tile.value)), unit: '%' };
    // A bearing in degrees is a number nobody reads as a direction.
    case 'direction':
      return { value: degToCompass(tile.value), unit: '' };
  }
}

export function ConditionTile({ tile, onPress }: { tile: Tile; onPress?: () => void }) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const { value, unit } = tileReading(tile, prefs);

  // Rainfall is the reading this app is opened for, so it keeps the colour it has
  // everywhere else — and a zero stays dimmed, so a real number stands out in a grid
  // of them. A temperature takes its colour from the scale, so the number and its
  // ink say the same thing; a day's high and low keep red and blue, because there the
  // colour means 'this is the top of the day', not 'this is warm'. Everything else is
  // heading ink: a grid where every block shouts is a grid where nothing does.
  const ink =
    tile.kind === 'mm'
      ? (tile.value ?? 0) > 0 ? palette.valPrecip : palette.valPrecipZero
      : tile.id === 'temp-max' ? palette.valHigh
        : tile.id === 'temp-min' ? palette.valLow
          : tile.kind === 'temp' ? temperatureColor(tile.value, appearance) ?? palette.valTemp
            : palette.appValue;

  const body = (
    <Card pad={0} style={{ flex: 1 }}>
      <View style={{ padding: space[4], gap: 2, minHeight: 96, justifyContent: 'space-between' }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          {tile.measured ? (
            <View
              style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.agroBright }}
            />
          ) : null}
          <Text
            variant="caption"
            weight="bold"
            color={palette.muted}
            numberOfLines={2}
            style={{
              flexShrink: 1, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: 10.5,
              textAlign: 'center',
            }}
          >
            {tile.title}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 3,
          }}
        >
          <Text variant="stat" color={ink} numberOfLines={1} tabular style={{ flexShrink: 1 }}>
            {value}
          </Text>
          {unit ? (
            <Text variant="caption" weight="semibold" color={palette.muted} style={{ fontSize: 11.5 }}>
              {unit}
            </Text>
          ) : null}
        </View>

        <Text
          variant="caption"
          color={palette.muted}
          numberOfLines={1}
          style={{ fontSize: 11, textAlign: 'center' }}
        >
          {tile.timeLabel}
        </Text>
      </View>
    </Card>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${tile.title}, ${tile.timeLabel}: ${value} ${unit}`.trim()}
      // The card carries its own shadow, so the press is a tint rather than a lift:
      // one block rising out of a grid takes its row's alignment with it.
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.72 : 1 })}
    >
      {body}
    </Pressable>
  );
}
