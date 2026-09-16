/**
 * A day that has happened, hour by hour.
 *
 * The rows above the rule on 'Verwachting' open this, and `DaySheet` opens for
 * everything below it. They are deliberately not the same sheet: `DaySheet` is built
 * around the ensemble — the members' spread, where the deterministic run sits inside
 * it, whether they agree — and none of that exists for a day that is over. What is
 * left once you take the ensemble out is the day's figures and its hours, which is
 * this.
 *
 * So there are no section tabs either. Tabs on the forecast sheet switch between
 * measurands because each has its own ensemble picture to show; here every measurand
 * is one column of the same table, and the table fits on one screen.
 *
 * The hourly list is `HourlyList` on its overview layer, which is the component the
 * forecast sheet uses for the same job. `pastOnly` turns off the dimming and the
 * per-row "meting" label: both exist to mark the past inside a list that is partly
 * future, and here the header says it once.
 */
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '../../theme';
import { Card, Rule } from '../Card';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { HourlyList } from './HourlyList';
import { usePrefs } from '../../state/prefs';
import { pastDetailHours, type PastHour } from '../../core/model/pastDays';
import { resolveDayValues } from '../../core/model/dayValues';
import type { Day } from '../../core/model/types';
import {
  convTemp, convWind, dayNames, fmtMm, t, ta, tempUnitLabel, windUnitLabel, wmoText,
} from '../../core/i18n';

export interface PastDaySheetProps {
  visible: boolean;
  day: Day | null;
  /** Every hour the page has, of every past day; the sheet takes its own. */
  hours: readonly PastHour[];
  /** The station's name where one measured this day, for the source line. */
  stationName?: string | null;
  onClose: () => void;
}

export function PastDaySheet({ visible, day, hours, stationName, onClose }: PastDaySheetProps) {
  const { palette } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {day ? (
        <Body day={day} hours={hours} stationName={stationName} onClose={onClose} />
      ) : (
        <View style={{ flex: 1, backgroundColor: palette.appBg }} />
      )}
    </Modal>
  );
}

/** Separate, so the `Modal` above never unmounts while it is presented — the same
 *  reason `DaySheet` splits its body out. */
function Body({
  day, hours, stationName, onClose,
}: {
  day: Day;
  hours: readonly PastHour[];
  stationName?: string | null;
  onClose: () => void;
}) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();

  const detail = pastDetailHours(hours, day.date);
  const v = resolveDayValues(day, { dayIndex: 0 });

  const date = new Date(day.date + 'T12:00:00Z');
  const names = dayNames(prefs.lang);
  const title = `${names[date.getUTCDay()]} ${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  // The row said which source spoke for the day; the sheet says it again, because a
  // sheet is read on its own and "20,4 mm" means different things measured and
  // modelled.
  const source = day.pastMeasured
    ? `AgroExact${stationName ? ` · ${stationName}` : ''}`
    : ta('observations', prefs.lang);

  return (
    <View style={{ flex: 1, backgroundColor: palette.appBg }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: space[3],
          paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[3],
        }}
      >
        <WeatherIcon wmo={day.dayIcon ?? day.wmo} isDay={1} size={28} />
        <View style={{ flex: 1 }}>
          <Text variant="locationName" color={palette.inkHeading}>
            {title}
          </Text>
          <Text variant="caption" color={palette.muted}>
            {wmoText(day.dayIcon ?? day.wmo, prefs.lang)} · {source}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('close', prefs.lang)}
          hitSlop={10}
          style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: palette.cream2,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="x" size={15} color={palette.muted} weight="bold" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
          gap: space[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          {/* The day in five figures, above its hours — the same five the row in the
              table carries, so opening a row does not change what it says. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space[4] }}>
            <Figure
              label={ta('tempMin', prefs.lang)}
              value={convTemp(v.tempMin.value, prefs.tempUnit)}
              unit={tempUnitLabel(prefs.tempUnit)}
              color={palette.valLow}
            />
            <Figure
              label={ta('tempMax', prefs.lang)}
              value={convTemp(v.tempMax.value, prefs.tempUnit)}
              unit={tempUnitLabel(prefs.tempUnit)}
              color={palette.valHigh}
            />
            <Figure
              label={ta('rain', prefs.lang)}
              value={v.precip.value != null ? fmtMm(v.precip.value) : null}
              unit="mm"
              color={v.precip.value ? palette.valPrecip : palette.valPrecipZero}
            />
            <Figure
              label={ta('maxWind', prefs.lang)}
              value={convWind(v.wind.value, prefs.windUnit)}
              unit={windUnitLabel(prefs.windUnit)}
              color={palette.valWind}
              lead={<WindArrow deg={v.windDir} size={12} color={palette.muted} />}
            />
            <Figure
              label={t('sun', prefs.lang)}
              value={v.sunHours != null ? v.sunHours.toFixed(1).replace('.', ',') : null}
              unit="u"
              color={palette.valSun}
            />
          </View>

          <Rule soft style={{ marginTop: space[4] }} />

          <HourlyList layer="overview" hours={detail} sourceLabel={source} pastOnly />
        </Card>
      </ScrollView>
    </View>
  );
}

/** One of the day's headline numbers. Half the width each, so five of them fall into
 *  a tidy grid on every phone rather than a row that wraps one figure onto its own. */
function Figure({
  label, value, unit, color, lead,
}: {
  label: string;
  value: string | number | null;
  unit: string;
  color: string;
  lead?: ReactNode;
}) {
  const { palette } = useTheme();
  return (
    <View style={{ width: '33.33%', gap: 2 }}>
      <Text variant="eyebrow" color={palette.muted} numberOfLines={1}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        {lead}
        <Text variant="bodySm" weight="bold" color={value == null ? palette.inkDisabled : color} tabular>
          {value ?? '—'}
          {value != null ? (
            <Text variant="caption" weight="semibold" color={palette.muted}>
              {` ${unit}`}
            </Text>
          ) : null}
        </Text>
      </View>
    </View>
  );
}
