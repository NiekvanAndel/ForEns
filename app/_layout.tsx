/**
 * Root layout: fonts, providers, and the status bar.
 *
 * Figtree is the brand typeface. It is bundled rather than fetched, so the first
 * paint never falls back to the system face — a silent font fallback would quietly
 * undo the design system's typography.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold,
  Figtree_700Bold, Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import { PrefsProvider, usePrefs } from '../state/prefs';
import { ThemeProvider } from '../state/theme';
import { ForecastProvider } from '../state/forecast';
import { useTheme } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or unavailable — not worth failing startup over.
});

function Shell() {
  const { palette, appearance } = useTheme();
  const { ready } = usePrefs();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.appBg }} />;

  return (
    <>
      <StatusBar style={appearance === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.appBg },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold,
    Figtree_700Bold, Figtree_800ExtraBold,
  });

  // A font that fails to load must not leave a permanently blank app; rendering
  // with the system face is worse-looking but usable.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PrefsProvider>
          <ThemeProvider>
            <ForecastProvider>
              <Shell />
            </ForecastProvider>
          </ThemeProvider>
        </PrefsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
