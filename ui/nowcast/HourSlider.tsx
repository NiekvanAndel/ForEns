/**
 * The compact hourly slider under the conditions hero.
 *
 * It sat inside the forecast card, one block above the daily list, which put the
 * next few hours a scroll away from the reading they follow from. It belongs to the
 * hero: the big number says what it is doing now, and this says what happens next.
 *
 * Runs through the past as well as the future and opens centred on the current hour,
 * so "has it been raining?" is a swipe left. Past cells are dimmed rather than
 * dropped — the shape of the morning is what makes the afternoon readable.
 */
import { View, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, useTheme } from '../../theme';
import { Text } from '../Text';
import { WeatherIcon } from '../WeatherIcon';
import { currentHourDecor, plainDecor } from '../forecast/currentHour';
import { useCenterOnIndex } from '../forecast/useCenterOnIndex';
import { usePrefs } from '../../state/prefs';
import { convTemp, fmtMm } from '../../core/i18n';
import { hourWindow } from '../../core/model/hourWindow';
import type { ForecastModel } from '../../core/model/types';

const CELL_WIDTH = 62;
const CELL_GAP = 6;
const BAR_HEIGHT = 26;
/** How much a past hour is faded. Enough to recede, not so much it cannot be read. */
const PAST_OPACITY = 0.45;

export function HourSlider({ model }: { model: ForecastModel }) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const { hours, nowIndex } = hourWindow(model, { ahead: 24, behind: 6 });
  // Scale the bars against the wettest hour shown, floored at 1 mm so a drizzle
  // does not render as a downpour just because nothing else is falling.
  const maxMm = Math.max(...hours.map((h) => h.precip ?? 0), 1);
  const decor = currentHourDecor(palette, appearance);
  const { ref, onLayout } = useCenterOnIndex(nowIndex, CELL_WIDTH, CELL_GAP);

  if (!hours.length) return null;

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={onLayout}
      contentContainerStyle={{ gap: CELL_GAP, paddingHorizontal: 12, paddingVertical: 10 }}
    >
      {hours.map((h, i) => {
        const mm = h.precip ?? 0;
        return (
          <View
            key={h.time}
            style={[
              {
                width: CELL_WIDTH, alignItems: 'center', borderRadius: radius.card,
                paddingVertical: 10, paddingHorizontal: 4,
                opacity: i < nowIndex ? PAST_OPACITY : 1,
              },
              i === nowIndex ? decor : plainDecor,
            ]}
          >
            <Text variant="caption" weight="semibold" color={palette.muted} tabular>
              {h.time.slice(11, 16)}
            </Text>

            <View style={{ marginVertical: 8 }}>
              <WeatherIcon wmo={h.wmo} isDay={h.isDay} size={24} />
            </View>

            <Text variant="bodySm" weight="bold" color={palette.valTemp} tabular>
              {convTemp(h.temp, prefs.tempUnit) ?? '—'}°
            </Text>

            <View style={{ height: BAR_HEIGHT, justifyContent: 'flex-end', marginTop: 8 }}>
              {mm > 0 ? (
                <LinearGradient
                  colors={[palette.sky, palette.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={{
                    width: 16,
                    height: Math.max(3, (mm / maxMm) * BAR_HEIGHT),
                    borderRadius: 3,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 16, height: 3, borderRadius: 3,
                    backgroundColor: palette.hairline,
                  }}
                />
              )}
            </View>

            <Text
              variant="caption"
              weight="bold"
              tabular
              color={mm > 0 ? palette.valPrecip : palette.valPrecipZero}
              style={{ fontSize: 11, marginTop: 6 }}
            >
              {fmtMm(mm)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
