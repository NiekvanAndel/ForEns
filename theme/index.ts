/**
 * Semantic theme layer.
 *
 * Components import from here, never from `tokens.generated.ts` directly, so that
 * renaming a design token is a change in one file. `useTheme()` returns the palette
 * for the active appearance; everything appearance-independent (spacing, radii, type)
 * is exported as a plain constant.
 */
import { createContext, useContext } from 'react';
import { colors, darkColors, numbers, strings, css } from './tokens.generated';

export type Appearance = 'light' | 'dark';

/** The dark palette. The design system only redefines the appearance-linked tokens
 *  for dark, so the rest is derived here — in its own language, using the navy family
 *  the system already defines for dark surfaces. */
const dark = {
  ...colors,
  ...darkColors,

  // Grounds: navy replaces cream, and the panel navy replaces white cards.
  cream: colors.navy,
  cream2: colors.navyMid,
  white: colors.navyPanel,
  appBg: colors.navy,
  appCard: colors.navyPanel,
  surfacePage: colors.navy,
  surfaceAlt: colors.navyMid,
  surfaceCard: colors.navyPanel,

  // Ink inverts to the on-navy set the system already specifies.
  ink: colors.onNavyBody,
  inkHeading: colors.onNavy,
  muted: colors.onNavyMuted,
  inkDisabled: colors.onNavyFaint,
  textBody: colors.onNavyBody,
  textHeading: colors.onNavy,
  textMuted: colors.onNavyMuted,
  appValue: colors.onNavy,

  // Accents lift so they hold against a dark ground.
  accent: colors.appAccentDark,
  accentDark: colors.skySoft,
  textAccent: colors.skySoft,

  // Station green lifts to stay legible on navy while staying unmistakably green.
  agroInk: colors.agroBright,
  textStation: colors.agroBright,

  // Hairlines invert from navy-on-white to white-on-navy.
  hairline: colors.ruleOnNavy,
  hairlineSoft: 'rgba(255,255,255,.07)',

  // Readings keep their hue but brighten, since the quantity's colour must not change
  // meaning between appearances — only its legibility.
  valHigh: '#E8817D',
  valLow: '#6FAEE8',
  valTemp: '#E8A94E',
  valPrecip: colors.sky,
  valPrecipZero: 'rgba(226,235,245,.42)',
  valWind: colors.onNavy,
  valSun: '#E8A94E',
} as const;

/** Every token name in either palette, mapped to a colour string.
 *  Deliberately not an intersection of the two literal-typed objects: light and dark
 *  give the same key different literal values, which reduces the intersection to
 *  `never` and makes every lookup an error. */
export type Palette = { [K in keyof typeof colors | keyof typeof dark]: string };

export const palettes = { light: colors, dark } as const;

export function paletteFor(appearance: Appearance): Palette {
  return (appearance === 'dark' ? dark : colors) as Palette;
}

export interface ThemeValue {
  palette: Palette;
  appearance: Appearance;
}

/** Defaults to light so a component rendered outside the provider — a screenshot
 *  harness, a test — still paints a complete palette rather than undefined colours. */
export const ThemeContext = createContext<ThemeValue>({
  palette: colors as Palette,
  appearance: 'light',
});

/** The active palette, resolved from the user's theme setting and the OS.
 *  Provided by `ThemeProvider`; never read `useColorScheme` directly in a component,
 *  or an explicit light/dark choice inside the app would be ignored. */
export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/** Spacing scale, in points. `space[5]` is the 16pt step the design uses for gutters. */
export const space = {
  1: numbers.space1, 2: numbers.space2, 3: numbers.space3, 4: numbers.space4,
  5: numbers.space5, 6: numbers.space6, 7: numbers.space7, 8: numbers.space8,
  9: numbers.space9, 10: numbers.space10, 11: numbers.space11, 12: numbers.space12,
  13: numbers.space13, 14: numbers.space14, 15: numbers.space15,
} as const;

export const radius = {
  field: numbers.radiusField,
  tile: numbers.radiusTile,
  card: numbers.radiusCard,
  appCard: numbers.radiusAppCard,
  band: numbers.radiusBand,
  pill: numbers.radiusPill,
} as const;

/** Type scale. Names follow the design system's own token names. */
export const fontSize = {
  h1: numbers.fsH1,
  h1App: numbers.fsH1App,
  h2: numbers.fsH2,
  h3: numbers.fsH3,
  h4: numbers.fsH4,
  lead: numbers.fsLead,
  body: numbers.fsBody,
  bodySm: numbers.fsBodySm,
  nav: numbers.fsNav,
  ui: numbers.fsUi,
  label: numbers.fsLabel,
  meta: numbers.fsMeta,
  eyebrow: numbers.fsEyebrow,
  caption: numbers.fsCaption,
  tag: numbers.fsTag,
  metric: numbers.fsMetric,
  metricApp: numbers.fsMetricApp,
  stat: numbers.fsStat,
} as const;

export const fontWeight = {
  light: '300', regular: '400', medium: '500',
  semibold: '600', bold: '700', black: '800',
} as const;

/** Figtree is the brand face; it is bundled and registered in the root layout. */
export const fontFamily = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  black: 'Figtree_800ExtraBold',
} as const;

/** Letter-spacing, converted from the design's `em` values at their intended size. */
export const tracking = {
  eyebrow: 0.14,
  tag: 0.05,
} as const;

/** The design's card shadow, decomposed for React Native.
 *  Source: `--shadow-card: 0 18px 50px -24px rgba(9,28,61,.28)`. RN has no spread,
 *  so the -24px inset is folded into a reduced radius and opacity. */
export const shadowCard = {
  shadowColor: '#091C3D',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.16,
  shadowRadius: 22,
  elevation: 6,
} as const;

/** `--shadow-float: 0 4px 14px rgba(0,0,0,.13)` */
export const shadowFloat = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.13,
  shadowRadius: 14,
  elevation: 4,
} as const;

export const duration = { fast: 180, base: 200, pulse: 2400 } as const;

/** Raw CSS-only tokens, for deliberate translation (gradients, glass materials). */
export { css as cssTokens, strings as rawStrings, numbers as rawNumbers };
