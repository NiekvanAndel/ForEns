/**
 * What every page has around it: the floating top row, and the swipe.
 *
 * All three pages carry the same chrome, and before this each one built its own —
 * which is how the search debounce came to differ between two of them. The page
 * supplies only its content.
 *
 * ## Why the row floats
 *
 * The row is glass, and glass over a solid background is just a tinted rectangle:
 * the material only means anything when there is content passing beneath it. So the
 * row is positioned over the page rather than stacked above it, and each page leaves
 * `TOP_BAR_CLEARANCE` plus its own safe-area inset at the top of its scroll content.
 *
 * The location's name went with it — into each page's scrolling content, where it
 * scrolls away like any other heading instead of holding a band of the screen for a
 * word the reader has already read. See `LocationTitle`.
 *
 * The swipe wraps the content but not the row: the controls stay put while the page
 * slides, which is what makes the dots read as a position indicator rather than as
 * part of the page.
 *
 * It takes the page as a component rather than as children, because the pager has to
 * be able to invoke it once per location — see `LocationPager`. So a route file is
 * a body component plus a one-line default export that frames it.
 */
import type { ComponentType } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';
import { TopBar } from './TopBar';
import { LocationPager } from './LocationPager';
import { usePlaceSearch } from './usePlaceSearch';
import { usePrefs } from '../state/prefs';

export function ScreenFrame({ page }: { page: ComponentType }) {
  const { palette } = useTheme();
  const { prefs, addLocation } = usePrefs();
  const { results, searching, onSearch } = usePlaceSearch(prefs.lang);

  return (
    <View style={{ flex: 1, backgroundColor: palette.appBg }}>
      <LocationPager page={page} />

      <TopBar
        onSearch={onSearch}
        results={results}
        searching={searching}
        onPick={(p) => addLocation({ name: p.name, lat: p.lat, lon: p.lon, sub: p.sub })}
      />
    </View>
  );
}
