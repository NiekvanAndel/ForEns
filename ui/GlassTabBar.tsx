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
 * The bar shows icons alone. The destinations are distinct enough to read as
 * pictures, and dropping the captions takes about a fifth off the bar's height —
 * which the radar page spends on its chart, whose play button used to sit behind
 * the bar. The words are not lost: each button still carries its label for
 * VoiceOver, which is where a name actually matters.
 *
 * ## Six of them, on a phone that may be 320 points wide
 *
 * The bar sizes its own icons from how many there are rather than to a constant.
 * Four fitted comfortably at 25 points; six at that size left the outer two touching
 * the capsule's ends on an SE, and a tab bar that overflows is worse than one drawn
 * a little smaller. So five or more step down, and the touch target does not go with
 * them — each button still fills its share of the bar's full height, which is what a
 * finger actually lands on.
 */
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, shadowCard, space, useTheme } from '../theme';
import { GlassSurface } from './GlassSurface';
import { Icon, type IconName } from './Icon';
import { useLandscape } from './layout';

/**
 * How much room a scrolling page must leave under its content so the last card
 * clears the floating bar. The bar is `position: absolute`, so nothing reserves
 * space for it: every tab page adds this to its own bottom inset.
 *
 * It is the bar's own height plus a little air — icons only, no labels, which is
 * what makes it short enough for a chart and its play button to sit above it.
 */
export const TAB_BAR_CLEARANCE = 84;

/**
 * The same, for the bar stood on its end against the right edge in landscape.
 *
 * Narrower than it is tall, because a column of icons is one icon wide where a row of
 * them is the screen: the capsule's width plus its padding and the air beside it.
 */
export const TAB_BAR_CLEARANCE_SIDE = 64;

/** Icon size by how many tabs share the bar. See the note above. */
function iconSize(count: number): number {
  return count >= 6 ? 21 : count === 5 ? 23 : 25;
}

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
  // Sideways the bar stands on its end against the right edge. A row of tabs across the
  // bottom of a landscape screen is a hand's width of travel between the first tab and
  // the last, and it spends the scarce dimension: height.
  const landscape = useLandscape();

  const dark = appearance === 'dark';

  const capsule = dark ? palette.glassCapsuleDark : palette.glassCapsule;
  const idle = dark ? palette.appTabIdleDark : palette.appTabIdle;
  const accent = dark ? palette.appAccentDark : palette.appAccent;
  const size = iconSize(items.length);
  const row = (
    // The gap goes with the icons: six capsules a full step apart leave the icons
    // themselves nowhere to sit.
    <View
      style={{
        flexDirection: landscape ? 'column' : 'row',
        alignItems: 'center',
        gap: items.length >= 6 ? 1 : 2,
      }}
    >
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
              // Across the bottom the tabs share the width equally; standing up they
              // are as tall as one icon needs, and the column is as long as it is.
              flex: landscape ? undefined : 1,
              alignSelf: 'stretch',
              alignItems: 'center',
              // No label under the icon, so the capsule is padded evenly rather
              // than being top-heavy around a two-storey cell. The vertical padding
              // grows as the icon shrinks, so the bar keeps its height and the
              // buttons keep their touch target.
              paddingVertical: 10 + (25 - size) / 2,
              borderRadius: radius.pill,
              backgroundColor: on ? capsule : 'transparent',
            }}
          >
            <Icon name={it.icon} size={size} color={on ? accent : idle} weight={on ? 'fill' : 'regular'} />
          </Pressable>
        );
      })}
    </View>
  );

  const along = items.length >= 6 ? 6 : 10;
  const shell = {
    borderRadius: radius.pill,
    // The padding follows the bar: the generous side is the one the icons run along.
    paddingVertical: landscape ? along : space[2],
    paddingHorizontal: landscape ? space[2] : along,
    overflow: 'hidden' as const,
  };

  return (
    <View
      pointerEvents="box-none"
      style={
        landscape
          ? {
              position: 'absolute',
              right: space[3] + insets.right,
              // Held against the middle of the edge rather than pinned top or bottom:
              // a thumb reaches the centre of the side it is holding.
              top: 0,
              bottom: 0,
              justifyContent: 'center',
            }
          : {
              position: 'absolute',
              // The notch takes one edge and the rounded corner the other, so the bar is
              // inset by whatever the hardware claims on top of its own margin.
              left: space[5] + insets.left,
              right: space[5] + insets.right,
              bottom: Math.max(insets.bottom, space[3]),
            }
      }
    >
      <GlassSurface interactive style={[shell, shadowCard]}>
        {row}
      </GlassSurface>
    </View>
  );
}
