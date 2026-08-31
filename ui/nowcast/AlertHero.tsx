/**
 * The conditional alert hero.
 *
 * Rendered only when `deriveAlert` finds something significant — the design's README
 * is explicit that this is not rain-only and that a quiet location shows no hero.
 *
 * It is the one navy surface on an otherwise cream screen, so the sheen overlay and
 * the on-navy text tokens are used rather than the ordinary ink palette.
 */
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, shadowCard, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import type { WeatherAlert } from '../../core/model/alert';

export function AlertHero({ alert }: { alert: WeatherAlert | null }) {
  const { palette } = useTheme();
  if (!alert) return null;

  return (
    <LinearGradient
      colors={[palette.navy, palette.navyMid, palette.navy2]}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        { borderRadius: radius.appCard, padding: space[7], paddingBottom: 18, overflow: 'hidden' },
        shadowCard,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Icon name={alert.icon} size={14} color={palette.sky} weight="fill" />
        <Text variant="eyebrow" color={palette.sky}>
          {alert.label}
        </Text>
      </View>

      <Text variant="headline" color={palette.onNavy} style={{ marginTop: 10 }}>
        {alert.headline}
      </Text>
      <Text variant="bodySm" color={palette.onNavyBody} style={{ marginTop: 7 }}>
        {alert.sub}
      </Text>

      <View
        style={{
          flexDirection: 'row', gap: 6, alignItems: 'flex-end',
          height: 56, marginTop: space[5],
        }}
        accessible
        accessibilityLabel={`Neerslagverloop: ${alert.bars.map((b) => `${b}%`).join(', ')}`}
      >
        {alert.bars.map((h, i) => (
          <Bar key={i} height={h} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }}>
        {['nu', '+30 min', '+60 min', '+2 uur'].map((l) => (
          <Text key={l} variant="caption" color={palette.onNavyMuted}>
            {l}
          </Text>
        ))}
      </View>
    </LinearGradient>
  );
}

/** One profile bar. Above 55% it fills with the sky gradient, between 18 and 55 it
 *  is a soft wash, and below that it reads as the empty track. */
function Bar({ height }: { height: number }) {
  const { palette } = useTheme();
  const style = {
    flex: 1,
    height: `${Math.max(4, Math.min(100, height))}%` as const,
    borderRadius: 4,
  };
  if (height > 55) {
    return (
      <LinearGradient
        colors={[palette.skySoft, palette.sky]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={style}
      />
    );
  }
  return (
    <View
      style={[
        style,
        { backgroundColor: height > 18 ? 'rgba(143,220,245,.4)' : palette.trackOnNavy },
      ]}
    />
  );
}
