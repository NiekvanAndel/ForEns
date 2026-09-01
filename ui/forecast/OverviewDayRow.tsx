/**
 * The overview day row — everything about a day on one line.
 *
 * This is the web app's `overzicht` tab: day and date, the condition icon, minimum
 * and maximum temperature, wind with its direction, precipitation, and sunshine
 * hours. No bar and no ensemble whisker; the point of this row is breadth, and the
 * per-measurand tabs are where a single quantity is read closely.
 *
 * Values come from `resolveDayValues`, so a reading the ensemble median stood in for
 * carries the same `~` the web app prints — the deterministic run was an outlier and
 * the reader should know the number is the ensemble's, not IFS's.
 *
 * Used by both 'Nu' and the 'Verwachting' overview tab, so the two cannot disagree.
 */
import { View, Pressable } from 'react-native';
import { radius, useTheme } from '../../theme';
import { Text } from '../Text';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { usePrefs } from '../../state/prefs';
import { convTemp, convWind, dayNames, fmtMm } from '../../core/i18n';
import { resolveDayValues } from '../../core/model/dayValues';
import type { Day } from '../../core/model/types';

export interface OverviewDayRowProps {
  day: Day;
  /** Position in the forecast. Decides which model speaks for the day. */
  dayIndex: number;
  onPress?: () => void;
}

export function OverviewDayRow({ day, dayIndex, onPress }: OverviewDayRowProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const v = resolveDayValues(day, { dayIndex });

  const date = new Date(day.date + 'T12:00:00Z');
  const names = dayNames(prefs.lang);

  const body = (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 9,
        paddingVertical: 11, paddingHorizontal: 4,
      }}
    >
      <View style={{ width: 46 }}>
        <Text variant="bodySm" weight="bold" color={palette.inkHeading}>
          {names[date.getUTCDay()]}
        </Text>
        <Text variant="caption" color={palette.muted} tabular style={{ fontSize: 12 }}>
          {date.getUTCDate()}/{date.getUTCMonth() + 1}
        </Text>
      </View>

      <WeatherIcon wmo={v.wmo ?? day.wmo} isDay={1} size={26} />

      {/* Minimum and maximum, low colour then high — the pair reads as one range. */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, width: 84 }}>
        <Reading
          value={convTemp(v.tempMin.value, prefs.tempUnit)}
          suffix="°"
          color={palette.valLow}
          approx={!v.tempMin.direct}
        />
        <Reading
          value={convTemp(v.tempMax.value, prefs.tempUnit)}
          suffix="°"
          color={palette.valHigh}
          approx={!v.tempMax.direct}
        />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, width: 58 }}>
        <WindArrow deg={v.windDir} size={11} color={palette.muted} />
        <Reading
          value={convWind(v.wind.value, prefs.windUnit)}
          color={palette.muted}
          approx={!v.wind.direct}
          small
        />
      </View>

      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Reading
          value={v.precip.value != null ? fmtMm(v.precip.value) : null}
          suffix=" mm"
          color={v.precip.value ? palette.valPrecip : palette.valPrecipZero}
          approx={!v.precip.direct}
        />
      </View>

      <View style={{ width: 52, alignItems: 'flex-end' }}>
        <Reading
          value={v.sunHours != null ? v.sunHours.toFixed(1).replace('.', ',') : null}
          suffix=" u"
          color={palette.valSun}
          small
        />
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // The row opens a sheet, so it acknowledges the tap rather than looking inert
      // for the moment before the sheet arrives.
      style={({ pressed }) => ({
        borderRadius: radius.tile,
        backgroundColor: pressed ? palette.pressedRow : 'transparent',
      })}
    >
      {body}
    </Pressable>
  );
}

/** One number, with the `~` the web app uses to mark an ensemble stand-in. */
function Reading({
  value, suffix, color, approx, small,
}: {
  value: string | number | null;
  suffix?: string;
  color: string;
  approx?: boolean;
  small?: boolean;
}) {
  const { palette } = useTheme();
  if (value == null) {
    return (
      <Text variant="label" color={palette.inkDisabled} tabular>
        —
      </Text>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text
        variant="bodySm"
        weight="bold"
        color={color}
        tabular
        style={small ? { fontSize: 14 } : undefined}
      >
        {value}
      </Text>
      {suffix ? (
        <Text variant="caption" weight="semibold" color={palette.muted} style={{ fontSize: 11 }}>
          {suffix}
        </Text>
      ) : null}
      {approx ? (
        <Text
          variant="caption"
          color={palette.muted}
          style={{ fontSize: 9, opacity: 0.55 }}
          accessibilityLabel="ensemblemediaan"
        >
          ~
        </Text>
      ) : null}
    </View>
  );
}
