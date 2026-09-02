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
 *
 * Each cell carries five readings: hour, condition, temperature, precipitation,
 * wind, and sunshine. There is no precipitation bar here. A bar and a number say
 * the same thing twice, and the room the bar took is what wind and sunshine now
 * use — the cells are wider for the same reason, so five stacked readings sit in a
 * calm column instead of being crushed against the cell's edges.
 */
import { View, ScrollView } from 'react-native';
import { radius, useTheme } from '../../theme';
import { Text } from '../Text';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { currentHourDecor, plainDecor } from '../forecast/currentHour';
import { useCenterOnIndex } from '../forecast/useCenterOnIndex';
import { usePrefs } from '../../state/prefs';
import { convTemp, convWind, fmtMm } from '../../core/i18n';
import { hourWindow } from '../../core/model/hourWindow';
import { sunnyHourWmo } from '../../core/model/conditions';
import type { ForecastModel } from '../../core/model/types';

/** Wide enough for "12,4" under a wind arrow without either touching the cell's
 *  edge. The bar that used to sit here was narrower than the numbers around it. */
const CELL_WIDTH = 74;
const CELL_GAP = 6;
/** The hour and its temperature are what the strip is read for, so both are a step
 *  up from the caption sizes around them. */
const TEMP_SIZE = 17;
/** How much a past hour is faded. Enough to recede, not so much it cannot be read. */
const PAST_OPACITY = 0.45;

export function HourSlider({ model }: { model: ForecastModel }) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const { hours, nowIndex } = hourWindow(model, { ahead: 24, behind: 6 });
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
              <WeatherIcon wmo={sunnyHourWmo(h)} isDay={h.isDay} size={26} />
            </View>

            <Text
              variant="bodySm"
              weight="bold"
              color={palette.valTemp}
              tabular
              style={{ fontSize: TEMP_SIZE }}
            >
              {convTemp(h.temp, prefs.tempUnit) ?? '—'}°
            </Text>

            {/* Precipitation as its amount alone. The unit is nested rather than a
                sibling, so a narrow cell cannot break "0,4 mm" across two lines. */}
            <Text
              variant="caption"
              weight="bold"
              tabular
              numberOfLines={1}
              color={mm > 0 ? palette.valPrecip : palette.valPrecipZero}
              style={{ fontSize: 12, marginTop: 8 }}
            >
              {fmtMm(mm)}
              <Text variant="caption" color={palette.muted} style={{ fontSize: 10 }}>
                {' '}mm
              </Text>
            </Text>

            {/* The arrow points the way the wind is going, so direction reads before
                the number does — which is the order it is asked about. */}
            <View style={{ alignItems: 'center', gap: 2, marginTop: 8 }}>
              <WindArrow deg={h.windDir ?? null} size={12} color={palette.muted} />
              <Text variant="caption" color={palette.muted} tabular numberOfLines={1} style={{ fontSize: 11.5 }}>
                {convWind(h.wind, prefs.windUnit) ?? '—'}
              </Text>
            </View>

            <Text
              variant="caption"
              weight="bold"
              color={palette.valSun}
              tabular
              numberOfLines={1}
              style={{ fontSize: 11.5, marginTop: 7 }}
            >
              {Math.round(h.sunMin ?? 0)}m
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
