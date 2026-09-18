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
 * Design rule 1 says green names a station and never a place — and every name here
 * is a place. The sync names a station's location after the town it stands in, so
 * the green was colouring a town for the station behind it. The heading ink is what
 * a place gets; the dot beside it is the station, and that stays green.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { space, useTheme } from '../theme';
import { Text } from './Text';
import { usePrefs } from '../state/prefs';

export interface LocationTitleProps {
  /**
   * Something to put at the end of the row — the pencil on 'Nu'.
   *
   * Here rather than in the top bar for the reason 'Actueel' puts its own pencil
   * beside the source line: arranging a page is something you do *to the page*, and
   * the top row is for moving between places.
   */
  action?: ReactNode;
}

export function LocationTitle({ action }: LocationTitleProps = {}) {
  const { palette } = useTheme();
  // `location`, not `prefs.locations[prefs.activeLocation]`. They are the same thing
  // on the page in front and different things on the pages either side of it: the
  // pager renders those through an override that redirects `location` alone. Reading
  // the selected index instead printed the name of the page you were leaving on the
  // page you were arriving at, so a swipe showed the same place twice with two
  // different sets of numbers under it.
  const { location } = usePrefs();
  if (!location) return null;

  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 7,
        paddingHorizontal: 2,
        paddingBottom: space[1],
      }}
    >
      {location.stationId ? (
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.agroBright }}
        />
      ) : null}
      <Text
        variant="locationName"
        color={palette.inkHeading}
        numberOfLines={1}
        style={{ flexShrink: 1 }}
      >
        {location.name}
      </Text>
      {action ? (
        <View style={{ marginLeft: 'auto', paddingLeft: space[3] }}>{action}</View>
      ) : null}
    </View>
  );
}
