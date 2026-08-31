/**
 * Theme provider.
 *
 * Resolves the palette from the user's theme preference and, when that is "auto",
 * the OS appearance. This is the only place `useColorScheme` is read — a component
 * reading it directly would ignore an explicit light or dark choice made in
 * Instellingen.
 */
import { useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeContext, paletteFor, type Appearance } from '../theme';
import { usePrefs } from './prefs';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const { prefs } = usePrefs();

  const appearance: Appearance =
    prefs.theme === 'auto' ? (scheme === 'dark' ? 'dark' : 'light') : prefs.theme;

  const value = useMemo(
    () => ({ palette: paletteFor(appearance), appearance }),
    [appearance]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
