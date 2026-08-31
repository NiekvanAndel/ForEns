/**
 * The conditional alert hero.
 *
 * Rendered only when `deriveAlert` finds something significant — the design's README
 * is explicit that this is not rain-only and that a quiet location shows no hero.
 *
 * It is the one navy surface on an otherwise cream screen, so the sheen overlay and
 * the on-navy text tokens are used rather than the ordinary ink palette.
 *
 * Deliberately textual. It carried a four-bar profile of the next two hours, which
 * duplicated the radar card directly below it and turned a heads-up into a second
 * chart. A heads-up is a sentence: what, and when. The profile lives on the radar
 * page, where there is room to read it.
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
        { borderRadius: radius.appCard, padding: space[7], overflow: 'hidden' },
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

    </LinearGradient>
  );
}
