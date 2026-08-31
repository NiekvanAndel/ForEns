/**
 * The location's name, on its own line under the top row.
 *
 * It was inside the top bar, competing with three controls for width and losing —
 * a long name truncated before a reader could tell which place they were looking
 * at. On its own row it has the whole screen.
 *
 * Design rule 1: green names a station, never a place. A plain address stays navy.
 */
import { View } from 'react-native';
import { space, useTheme } from '../theme';
import { Text } from './Text';
import { usePrefs } from '../state/prefs';

export function LocationTitle() {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const active = prefs.locations[prefs.activeLocation] ?? prefs.locations[0];
  if (!active) return null;

  const sub = active.stationName ?? active.sub;

  return (
    <View style={{ paddingHorizontal: space[5], paddingBottom: space[3], gap: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        {active.stationId ? (
          <View
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.agroBright }}
          />
        ) : null}
        <Text
          variant="screenTitle"
          color={active.stationId ? palette.agroInk : palette.inkHeading}
          numberOfLines={1}
          style={{ flexShrink: 1 }}
        >
          {active.name}
        </Text>
      </View>
      {sub ? (
        <Text variant="caption" color={palette.muted} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}
