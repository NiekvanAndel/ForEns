/**
 * What every page has around it: the top row, the location name, and the swipe.
 *
 * All three pages carry the same chrome, and before this each one built its own —
 * which is how the search debounce came to differ between two of them. The page
 * supplies only its content.
 *
 * The swipe wraps the name and the content but not the top row: the controls stay
 * put while the page — the name included, since that is what changed — slides.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { TopBar } from './TopBar';
import { LocationPager } from './LocationPager';
import { LocationTitle } from './LocationTitle';
import { usePlaceSearch } from './usePlaceSearch';
import { usePrefs } from '../state/prefs';

export function ScreenFrame({
  children, compactTitle,
}: { children: ReactNode; compactTitle?: boolean }) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const { prefs, addLocation } = usePrefs();
  const { results, searching, onSearch } = usePlaceSearch(prefs.lang);

  return (
    <View style={{ flex: 1, backgroundColor: palette.appBg, paddingTop: insets.top }}>
      <TopBar
        onSearch={onSearch}
        results={results}
        searching={searching}
        onPick={(p) => addLocation({ name: p.name, lat: p.lat, lon: p.lon, sub: p.sub })}
      />

      <LocationPager>
        <LocationTitle compact={compactTitle} />
        {children}
      </LocationPager>
    </View>
  );
}
