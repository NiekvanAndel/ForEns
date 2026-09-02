/**
 * The app's one piece of glass, as a surface anything floating can sit on.
 *
 * Glass is for floating chrome, not for content — Apple's iOS 26 guidance and the
 * design system's own rule, which is why every card in the app is solid. The tab bar
 * was the only such surface; the top row is the second, and both have to composite
 * the same way or the two ends of the screen read as different materials.
 *
 * On iOS 26 this is the real `UIGlassEffect`. The design also specifies an opaque
 * material for Reduce Transparency, honoured here through the accessibility setting
 * rather than left to the OS: a `GlassView` still composites, so a reader who asked
 * for less transparency must get the flat material instead.
 *
 * The colour scheme is pinned rather than 'auto', because the app has its own theme
 * setting — a reader who chose light inside a dark OS must not get dark glass.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../theme';

/** True when the user has asked for reduced transparency. */
export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.().then((v) => {
      if (alive) setReduce(!!v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}

export interface GlassSurfaceProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Glass that reacts to touch — for a bar whose contents are pressed. */
  interactive?: boolean;
}

export function GlassSurface({ children, style, interactive }: GlassSurfaceProps) {
  const { palette, appearance } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const dark = appearance === 'dark';
  const useGlass = isLiquidGlassAvailable() && !reduceTransparency && Platform.OS === 'ios';

  if (!useGlass) {
    const opaque = dark ? palette.glassTintDarkOpaque : palette.glassTintOpaque;
    return <View style={[style, { backgroundColor: opaque }]}>{children}</View>;
  }

  return (
    <GlassView
      glassEffectStyle={dark ? 'regular' : 'clear'}
      colorScheme={dark ? 'dark' : 'light'}
      isInteractive={interactive}
      style={style}
    >
      {children}
    </GlassView>
  );
}
