/**
 * The whole day in six figures, above its hours.
 *
 * Its own file because two sheets show it: the forecast's `DaySheet` on its overview
 * section, and `PastDaySheet` for a day that has already happened. They have nothing
 * else in common — one is built around the ensemble and the other has none — so the
 * grid living in the forecast sheet would mean the past sheet importing a chart, a
 * beam and a meteogram to reach it.
 *
 * Values come from `resolveDayValues`, so the cells agree with the list row that
 * opened them, whichever model or instrument each figure came from.
 */
import { View } from 'react-native';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import { usePrefs } from '../../state/prefs';
import { resolveDayValues } from '../../core/model/dayValues';
import type { Day } from '../../core/model/types';
import { convTemp, convWind, fmtMm, t, tempUnitLabel, windUnitLabel } from '../../core/i18n';

export function DaySummaryCells({ day, dayIndex }: { day: Day; dayIndex: number }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const v = resolveDayValues(day, { dayIndex });

  const cells: { label: string; value: string; color?: string }[] = [
    {
      label: t('maxTemp', prefs.lang),
      value: `${convTemp(v.tempMax.value, prefs.tempUnit) ?? '—'}${tempUnitLabel(prefs.tempUnit)}`,
      color: palette.valHigh,
    },
    {
      label: t('minTemp', prefs.lang),
      value: `${convTemp(v.tempMin.value, prefs.tempUnit) ?? '—'}${tempUnitLabel(prefs.tempUnit)}`,
      color: palette.valLow,
    },
    {
      label: t('tabPrecip', prefs.lang),
      value: v.precip.value != null ? `${fmtMm(v.precip.value)} mm` : '—',
      color: v.precip.value ? palette.valPrecip : palette.valPrecipZero,
    },
    {
      label: t('tabWind', prefs.lang),
      value: `${convWind(v.wind.value, prefs.windUnit) ?? '—'} ${windUnitLabel(prefs.windUnit)}`,
    },
    {
      label: t('sunHours', prefs.lang),
      value: v.sunHours != null ? `${v.sunHours.toFixed(1).replace('.', ',')} u` : '—',
      color: palette.valSun,
    },
    {
      label: t('evap', prefs.lang),
      value: v.et0 != null ? `${fmtMm(v.et0)} mm` : '—',
    },
  ];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space[2] }}>
      {cells.map((c, i) => (
        <View
          key={c.label}
          style={{
            width: '33.33%',
            paddingVertical: space[3],
            alignItems: 'center',
            borderTopWidth: 1,
            borderTopColor: palette.hairlineSoft,
          }}
        >
          <Text variant="caption" color={palette.muted}>
            {c.label}
          </Text>
          <Text
            variant="stat"
            color={c.color ?? palette.inkHeading}
            tabular
            style={{ marginTop: 4, fontSize: 18 }}
          >
            {c.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
