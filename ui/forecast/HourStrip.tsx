/**
 * The short-term hourly strip.
 *
 * Follows the design's "Detail korte termijn" card: 74pt cells carrying time,
 * condition, temperature, millimetres, a precipitation bar, wind, and sunshine
 * minutes. The current hour is washed in `--sky-wash`.
 */
import { ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { usePrefs } from '../../state/prefs';
import { convTemp, convWind, fmtMm } from '../../core/i18n';
import type { Hour } from '../../core/model/types';

const BAR_HEIGHT = 34;

export function HourStrip({ hours }: { hours: Hour[] }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  // Scale the bars against the wettest hour shown, floored at 1 mm so a drizzle
  // does not render as a downpour just because nothing else is falling.
  const maxMm = Math.max(...hours.map((h) => h.precip ?? 0), 1);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
    >
      {hours.map((h, i) => {
        const mm = h.precip ?? 0;
        return (
          <View
            key={h.time}
            style={{
              width: 74, alignItems: 'center',
              borderRadius: radius.card, paddingVertical: space[3], paddingHorizontal: 6,
              backgroundColor: i === 0 ? palette.skyWash : 'transparent',
            }}
          >
            <Text variant="caption" weight="semibold" color={palette.muted} tabular>
              {h.time.slice(11, 16)}
            </Text>

            <View style={{ marginVertical: space[2] }}>
              <WeatherIcon wmo={h.wmo} isDay={h.isDay} size={24} />
            </View>

            <Text variant="bodySm" weight="bold" color={palette.valTemp} tabular>
              {convTemp(h.temp, prefs.tempUnit) ?? '—'}°
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
              <Text
                variant="caption"
                weight="bold"
                tabular
                color={mm > 0 ? palette.valPrecip : palette.valPrecipZero}
                style={{ fontSize: 12 }}
              >
                {fmtMm(mm)}
              </Text>
              <Text variant="caption" weight="semibold" color={palette.muted} style={{ fontSize: 10 }}>
                {' '}mm
              </Text>
            </View>

            <View style={{ height: BAR_HEIGHT, justifyContent: 'flex-end', marginTop: 6 }}>
              {mm > 0 ? (
                <LinearGradient
                  colors={[palette.sky, palette.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={{
                    width: 18,
                    height: Math.max(3, (mm / maxMm) * BAR_HEIGHT),
                    borderRadius: 4,
                  }}
                />
              ) : (
                <View style={{ width: 18, height: 3, borderRadius: 4, backgroundColor: palette.hairline }} />
              )}
            </View>

            <View style={{ alignItems: 'center', gap: 2, marginTop: 7 }}>
              <WindArrow deg={h.windDir ?? null} size={12} color={palette.muted} />
              <Text variant="caption" color={palette.muted} tabular style={{ fontSize: 11.5 }}>
                {convWind(h.wind, prefs.windUnit) ?? '—'}
              </Text>
            </View>

            <Text
              variant="caption"
              weight="bold"
              color={palette.valSun}
              tabular
              style={{ fontSize: 11.5, marginTop: 5 }}
            >
              {h.sunMin ?? 0}m
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
