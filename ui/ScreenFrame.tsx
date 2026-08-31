/**
 * What every page has around it: the top bar, the swipe, and settings.
 *
 * All three pages carry the same chrome, and before this each one built its own —
 * which is how the search debounce came to differ between two of them. The page
 * supplies only its content.
 *
 * The swipe wraps the content, not the bar: the location name and dots stay put
 * while the page beneath them slides, which is what makes the change legible.
 */
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { TopBar } from './TopBar';
import { LocationPager } from './LocationPager';
import { SettingsSheet } from './settings/SettingsSheet';
import { usePlaceSearch } from './usePlaceSearch';
import { usePrefs } from '../state/prefs';

export function ScreenFrame({ children }: { children: ReactNode }) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const { prefs, addLocation } = usePrefs();
  const { results, searching, onSearch } = usePlaceSearch(prefs.lang);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: palette.appBg, paddingTop: insets.top }}>
      <TopBar
        onSearch={onSearch}
        results={results}
        searching={searching}
        onPick={(p) => addLocation({ name: p.name, lat: p.lat, lon: p.lon, sub: p.sub })}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <LocationPager>{children}</LocationPager>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}
