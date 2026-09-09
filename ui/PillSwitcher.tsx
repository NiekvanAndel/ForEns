/**
 * A row of pills, one of them chosen.
 *
 * Design: a horizontal pill row, the selected one carrying the primary gradient with
 * white text, the rest on `--cream-2`. Buttons are full pills (design rule 5).
 *
 * Two pages pick one thing out of a short list this way — the layer on 'Verwachting'
 * and the measurement on 'Grafiek' — and they were two separate rows until the second
 * one grew an icon and a gradient to match the first. One component means they cannot
 * drift apart again: a reader moving between the pages meets the same control, and a
 * change to it is a change to both.
 *
 * It scrolls sideways because both lists have outgrown a phone's width. The first few
 * entries still land in view without moving anything, so the common choices are a tap
 * away and the rest are a slide.
 */
import { ScrollView, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, space, useTheme } from '../theme';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';

export interface PillItem<K extends string> {
  key: K;
  icon: IconName;
  label: string;
}

export interface PillSwitcherProps<K extends string> {
  items: readonly PillItem<K>[];
  active: K;
  onChange: (key: K) => void;
  /** Padding under the row, where the caller wants the scroll indicator's room. */
  paddingBottom?: number;
}

export function PillSwitcher<K extends string>({
  items, active, onChange, paddingBottom = 0,
}: PillSwitcherProps<K>) {
  const { palette } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space[2], paddingBottom, paddingRight: space[4] }}
    >
      {items.map((item) => {
        const on = item.key === active;
        const content = (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={item.icon} size={15} color={on ? '#fff' : palette.inkHeading} />
            <Text variant="label" weight="semibold" color={on ? '#fff' : palette.inkHeading}>
              {item.label}
            </Text>
          </View>
        );

        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={item.label}
            style={{ borderRadius: radius.pill, overflow: 'hidden' }}
          >
            {on ? (
              <LinearGradient
                colors={[palette.accent, palette.accentDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 9, paddingHorizontal: 15 }}
              >
                {content}
              </LinearGradient>
            ) : (
              <View
                style={{
                  paddingVertical: 9, paddingHorizontal: 15,
                  backgroundColor: palette.cream2,
                }}
              >
                {content}
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
