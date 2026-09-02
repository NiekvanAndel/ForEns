/**
 * The liquid-glass tab bar.
 *
 * Glass is for floating chrome, not for content — `TabBar.jsx` is a translucent tint
 * over a blurred, saturated backdrop, and every card in the app is solid white on
 * cream. That matches Apple's iOS 26 guidance.
 *
 * The material itself is `GlassSurface`, shared with the top row so the two ends of
 * the screen cannot drift apart.
 *
 * The bar shows icons alone. The four destinations are distinct enough to read as
 * pictures, and dropping the captions takes about a fifth off the bar's height —
 * which the radar page spends on its chart, whose play button used to sit behind
 * the bar. The words are not lost: each button still carries its label for
 * VoiceOver, which is where a name actually matters.
 */
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, shadowCard, space, useTheme } from '../theme';
import { GlassSurface } from './GlassSurface';
import { Icon, type IconName } from './Icon';

/**
 * How much room a scrolling page must leave under its content so the last card
 * clears the floating bar. The bar is `position: absolute`, so nothing reserves
 * space for it: every tab page adds this to its own bottom inset.
 *
 * It is the bar's own height plus a little air — icons only, no labels, which is
 * what makes it short enough for a chart and its play button to sit above it.
 */
export const TAB_BAR_CLEARANCE = 84;

export interface TabItem {
  key: string;
  label: string;
  icon: IconName;
}

export interface GlassTabBarProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function GlassTabBar({ items, activeKey, onChange }: GlassTabBarProps) {
  const { palette, appearance } = useTheme();
  const insets = useSafeAreaInsets();

  const dark = appearance === 'dark';

  const capsule = dark ? palette.glassCapsuleDark : palette.glassCapsule;
  const idle = dark ? palette.appTabIdleDark : palette.appTabIdle;
  const accent = dark ? palette.appAccentDark : palette.appAccent;
  const row = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {items.map((it) => {
        const on = it.key === activeKey;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={it.label}
            style={{
              flex: 1,
              alignItems: 'center',
              // No label under the icon, so the capsule is padded evenly rather
              // than being top-heavy around a two-storey cell.
              paddingVertical: 10,
              borderRadius: radius.pill,
              backgroundColor: on ? capsule : 'transparent',
            }}
          >
            <Icon name={it.icon} size={25} color={on ? accent : idle} weight={on ? 'fill' : 'regular'} />
          </Pressable>
        );
      })}
    </View>
  );

  const shell = {
    borderRadius: radius.pill,
    paddingVertical: space[2],
    paddingHorizontal: 10,
    overflow: 'hidden' as const,
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: space[5],
        right: space[5],
        bottom: Math.max(insets.bottom, space[3]),
      }}
    >
      <GlassSurface interactive style={[shell, shadowCard]}>
        {row}
      </GlassSurface>
    </View>
  );
}
