/**
 * The location's name, at the head of the page's own content.
 *
 * It was inside the top bar, competing with three controls for width and losing —
 * a long name truncated before a reader could tell which place they were looking
 * at. Then it sat in a fixed band under the row, which held a strip of every screen
 * for a word already read. It is the first thing in the scroll now, so it introduces
 * the page and then gets out of the way.
 *
 * One size and one form everywhere, because the pages are read one after another and
 * a name that changes weight between them reads as a different kind of thing. The
 * region line is gone with the larger form: the name is the answer, and the page
 * below it says the rest.
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

  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 7,
        paddingHorizontal: 2,
        paddingBottom: space[1],
      }}
    >
      {active.stationId ? (
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.agroBright }}
        />
      ) : null}
      <Text
        variant="locationName"
        color={active.stationId ? palette.agroInk : palette.inkHeading}
        numberOfLines={1}
        style={{ flexShrink: 1 }}
      >
        {active.name}
      </Text>
    </View>
  );
}
