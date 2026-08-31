/**
 * Typography primitives.
 *
 * Every text style in the app comes from here, so the design system's type scale is
 * applied in one place. `scale` honours the user's text-size preference, which the
 * web app applied through a `--fz` CSS variable.
 */
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { fontFamily, fontSize, fontWeight, tracking, useTheme } from '../theme';
import { usePrefs } from '../state/prefs';
import { FONT_SCALE } from '../core/i18n/units';

export type TextRole =
  | 'screenTitle'   // 28px — an iOS screen title
  | 'locationName'  // 23px — the conditions hero's location
  | 'metric'        // 58px — the big reading
  | 'stat'          // 21px — a divider-row value
  | 'headline'      // 27px — the alert hero headline
  | 'body'
  | 'bodySm'
  | 'label'
  | 'caption'
  | 'eyebrow';      // uppercase, letterspaced card label

const ROLE: Record<TextRole, TextStyle> = {
  screenTitle: { fontSize: fontSize.h1App, fontFamily: fontFamily.bold, letterSpacing: -0.5 },
  locationName: { fontSize: 23, fontFamily: fontFamily.bold, letterSpacing: -0.23 },
  metric: { fontSize: 58, fontFamily: fontFamily.black, letterSpacing: -1.74, lineHeight: 58 },
  stat: { fontSize: 21, fontFamily: fontFamily.bold },
  headline: { fontSize: 27, fontFamily: fontFamily.semibold, lineHeight: 32.4 },
  body: { fontSize: fontSize.body, fontFamily: fontFamily.regular, lineHeight: fontSize.body * 1.5 },
  bodySm: { fontSize: fontSize.bodySm, fontFamily: fontFamily.regular, lineHeight: fontSize.bodySm * 1.6 },
  label: { fontSize: fontSize.label, fontFamily: fontFamily.semibold },
  caption: { fontSize: fontSize.caption, fontFamily: fontFamily.regular },
  eyebrow: {
    fontSize: fontSize.eyebrow,
    fontFamily: fontFamily.bold,
    letterSpacing: fontSize.eyebrow * tracking.eyebrow,
    textTransform: 'uppercase',
  },
};

export interface AppTextProps extends TextProps {
  /** Named `variant`, not `role`: React Native's TextProps already defines `role`
   *  as the ARIA role, and shadowing it breaks accessibility typing. */
  variant?: TextRole;
  /** A palette token name, or any colour literal. */
  color?: string;
  weight?: keyof typeof fontWeight;
  /** Numbers that line up in columns need tabular figures. */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
}

const WEIGHT_FAMILY: Record<keyof typeof fontWeight, string> = {
  light: fontFamily.regular,
  regular: fontFamily.regular,
  medium: fontFamily.medium,
  semibold: fontFamily.semibold,
  bold: fontFamily.bold,
  black: fontFamily.black,
};

export function Text({
  variant = 'body', color, weight, tabular, align, style, ...rest
}: AppTextProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const scale = FONT_SCALE[prefs.fontSize] ?? 1;
  const base = ROLE[variant];

  // Scale font size and line height together, or large text collapses on itself.
  const scaled: TextStyle = {
    ...base,
    fontSize: (base.fontSize ?? 16) * scale,
    ...(base.lineHeight ? { lineHeight: base.lineHeight * scale } : {}),
    ...(base.letterSpacing ? { letterSpacing: base.letterSpacing * scale } : {}),
  };

  return (
    <RNText
      {...rest}
      style={[
        scaled,
        { color: color ?? palette.ink },
        weight ? { fontFamily: WEIGHT_FAMILY[weight] } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
