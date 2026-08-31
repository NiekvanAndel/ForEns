/**
 * The liquid-glass tab bar.
 *
 * This is the only glass surface in the design system — `TabBar.jsx` is a
 * translucent tint over a blurred, saturated backdrop, and everything else is solid
 * white on cream. That matches Apple's iOS 26 guidance: glass is for floating
 * chrome, not for content.
 *
 * On iOS 26 this uses the real `UIGlassEffect` through expo-glass-effect. The design
 * also specifies an "opaque" material for Reduce Transparency, which is honoured
 * here through the accessibility setting rather than being left to the OS — a
 * `GlassView` still composites, so a user who asked for less transparency must get
 * the flat material instead.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { radius, shadowCard, space, useTheme } from '../theme';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';

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

/** True when the user has asked for reduced transparency. */
function useReduceTransparency(): boolean {
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

export function GlassTabBar({ items, activeKey, onChange }: GlassTabBarProps) {
  const { palette, appearance } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceTransparency = useReduceTransparency();

  const dark = appearance === 'dark';
  // Real glass only when the OS provides it and the user has not opted out.
  const useGlass = isLiquidGlassAvailable() && !reduceTransparency && Platform.OS === 'ios';

  const capsule = dark ? palette.glassCapsuleDark : palette.glassCapsule;
  const idle = dark ? palette.appTabIdleDark : palette.appTabIdle;
  const accent = dark ? palette.appAccentDark : palette.appAccent;
  const opaqueTint = dark ? palette.glassTintDarkOpaque : palette.glassTintOpaque;

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
              gap: 3,
              paddingTop: space[2],
              paddingBottom: 6,
              borderRadius: radius.pill,
              backgroundColor: on ? capsule : 'transparent',
            }}
          >
            <Icon name={it.icon} size={24} color={on ? accent : idle} weight={on ? 'fill' : 'regular'} />
            <Text
              variant="caption"
              weight={on ? 'semibold' : 'medium'}
              color={on ? accent : idle}
              style={{ fontSize: 12 }}
            >
              {it.label}
            </Text>
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
      {useGlass ? (
        <GlassView
          glassEffectStyle={dark ? 'regular' : 'clear'}
          // Pinned rather than 'auto': the app has its own theme setting, so a user
          // who chose light inside a dark OS must not get dark glass under it.
          colorScheme={dark ? 'dark' : 'light'}
          isInteractive
          style={[shell, shadowCard]}
        >
          {row}
        </GlassView>
      ) : (
        <View style={[shell, shadowCard, { backgroundColor: opaqueTint }]}>{row}</View>
      )}
    </View>
  );
}
