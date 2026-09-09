/**
 * The six tabs, with the design's glass bar replacing the platform one.
 *
 * The design puts the tab bar as a floating capsule inset from the screen edges, so
 * the native bar is hidden and `GlassTabBar` is rendered over the content instead.
 *
 * The order is the order the pages are read in: what it is doing now, the readings
 * behind that, where the rain is, what it has been doing, what it will do, and the
 * settings last. 'Actueel' sits beside 'Nu' because they answer the same question at
 * different grain — the hero's headline, then every figure under it — and 'Grafiek'
 * beside 'Radar' because both are pictures of a period rather than of an instant.
 */
import { Tabs, useRouter, useSegments } from 'expo-router';
import { View } from 'react-native';
import { GlassTabBar, type TabItem } from '../../ui/GlassTabBar';
import { useTheme } from '../../theme';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';

const TABS = [
  { key: 'index', labelKey: 'tabNow', icon: 'broadcast' },
  { key: 'actueel', labelKey: 'tabCurrent', icon: 'squares-four' },
  { key: 'radar', labelKey: 'tabRadar', icon: 'drop' },
  { key: 'grafiek', labelKey: 'tabGraph', icon: 'chart-line' },
  { key: 'forecast', labelKey: 'tabForecast', icon: 'calendar-blank' },
  { key: 'settings', labelKey: 'tabSettings', icon: 'gear-six' },
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
        <Tabs.Screen name="actueel" />
        <Tabs.Screen name="radar" />
        <Tabs.Screen name="grafiek" />
        <Tabs.Screen name="forecast" />
        <Tabs.Screen name="settings" />
      </Tabs>
      <GlassTabBar
        items={items}
        activeKey={activeKey}
        onChange={(key) => router.replace(key === 'index' ? '/' : `/${key}`)}
      />
    </View>
  );
}
