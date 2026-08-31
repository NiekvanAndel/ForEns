/**
 * The three tabs, with the design's glass bar replacing the platform one.
 *
 * The design puts the tab bar as a floating capsule inset from the screen edges, so
 * the native bar is hidden and `GlassTabBar` is rendered over the content instead.
 *
 * Settings is no longer among them: it moved into the top row and opens as a sheet
 * over whichever page you are on, so the bar carries only the three places you move
 * between rather than three places and a drawer.
 */
import { Tabs, useRouter, useSegments } from 'expo-router';
import { View } from 'react-native';
import { GlassTabBar, type TabItem } from '../../ui/GlassTabBar';
import { useTheme } from '../../theme';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';

const TABS = [
  { key: 'index', labelKey: 'tabNow', icon: 'broadcast' },
  { key: 'radar', labelKey: 'tabRadar', icon: 'drop' },
  { key: 'forecast', labelKey: 'tabForecast', icon: 'calendar-blank' },
] as const;

export default function TabsLayout() {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const router = useRouter();
  const segments = useSegments();

  // The last segment is the route name; the group's index route reports as "(tabs)".
  const last = segments[segments.length - 1];
  const activeKey = TABS.some((tab) => tab.key === last) ? (last as string) : 'index';

  const items: TabItem[] = TABS.map((tab) => ({
    key: tab.key,
    icon: tab.icon,
    label: ta(tab.labelKey, prefs.lang),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: palette.appBg }}>
      <Tabs
        screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}
        // The native bar is hidden, so its own button row must not take touches.
        tabBar={() => null}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="radar" />
        <Tabs.Screen name="forecast" />
      </Tabs>
      <GlassTabBar
        items={items}
        activeKey={activeKey}
        onChange={(key) => router.replace(key === 'index' ? '/' : `/${key}`)}
      />
    </View>
  );
}
