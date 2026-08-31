/**
 * Settings primitives: grouped card, row, segmented control, toggle.
 *
 * Mirrors the design's SettingsScreen — an eyebrow label above a borderless white
 * card, rows separated by soft hairlines, segmented controls on `--cream-2`, and a
 * toggle carrying the primary gradient when on.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { duration, radius, shadowFloat, space, useTheme } from '../../theme';
import { Card } from '../Card';
import { Text } from '../Text';
import { Icon } from '../Icon';

export function Group({ label, children }: { label: string; children: ReactNode }) {
  const { palette } = useTheme();
  return (
    <View>
      <Text variant="eyebrow" color={palette.muted} style={{ paddingHorizontal: 6, paddingBottom: space[2] }}>
        {label}
      </Text>
      <Card pad={0}>{children}</Card>
    </View>
  );
}

export interface RowProps {
  icon?: string;
  label: ReactNode;
  hint?: string;
  children?: ReactNode;
  last?: boolean;
  /** Lays the control beneath the label instead of beside it, for wide controls. */
  stacked?: boolean;
  onPress?: () => void;
}

export function Row({ icon, label, hint, children, last, stacked, onPress }: RowProps) {
  const { palette } = useTheme();

  const body = (
    <View
      style={{
        paddingVertical: space[4],
        paddingHorizontal: space[5],
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.hairlineSoft,
        gap: stacked ? space[3] : 0,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        {icon ? (
          <View style={{ width: 20 }}>
            <Icon name={icon} size={20} color={palette.muted} />
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          {typeof label === 'string' ? (
            <Text variant="bodySm" weight="semibold" color={palette.inkHeading}>
              {label}
            </Text>
          ) : (
            label
          )}
          {hint ? (
            <Text variant="caption" color={palette.muted} style={{ marginTop: 2, lineHeight: 17 }}>
              {hint}
            </Text>
          ) : null}
        </View>
        {!stacked && children ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>{children}</View>
        ) : null}
      </View>
      {stacked && children ? <View>{children}</View> : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  );
}

export interface SegmentedProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
  /** Let the control fill its row, for option sets too wide to sit beside a label. */
  fill?: boolean;
}

export function Segmented<T extends string>({
  options, value, onChange, compact, fill,
}: SegmentedProps<T>) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 3,
        backgroundColor: palette.cream2,
        borderRadius: radius.pill,
        padding: 3,
        alignSelf: fill ? 'stretch' : 'flex-end',
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={[
              {
                flex: fill ? 1 : undefined,
                alignItems: 'center',
                borderRadius: radius.pill,
                paddingVertical: compact ? 6 : 7,
                paddingHorizontal: compact ? 11 : 14,
                backgroundColor: on ? palette.appCard : 'transparent',
              },
              on ? shadowFloat : null,
            ]}
          >
            <Text
              variant="label"
              weight="semibold"
              color={on ? palette.accentDark : palette.muted}
              style={compact ? { fontSize: 12.5 } : undefined}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({
  on, onChange, label,
}: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  const { palette } = useTheme();
  const progress = useSharedValue(on ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(on ? 1 : 0, { duration: duration.fast });
  }, [on, progress]);

  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 20 }],
  }));

  return (
    <Pressable
      onPress={() => onChange(!on)}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={{
        width: 50, height: 30, borderRadius: radius.pill, padding: 3,
        backgroundColor: on ? palette.accent : palette.borderGhost,
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
          shadowFloat,
          knob,
        ]}
      />
    </Pressable>
  );
}
