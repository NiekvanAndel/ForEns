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
 * What it does share is the top of the sheet: the same six figures from
 * `DaySummaryCells`, and the same hour-by-hour table from `HourlyList` on its overview
 * layer. A day is a day, and a reader moving between the two halves of the table should
 * not have to learn a second layout to read one. `pastOnly` turns off the list's
 * dimming and its per-row "meting" label: both exist to mark the past inside a list
 * that is partly future, and here the header says it once.
 */
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '../../theme';
import { Card } from '../Card';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { WeatherIcon } from '../WeatherIcon';
import { DaySummaryCells } from './DaySummaryCells';
import { HourlyList } from './HourlyList';
import { usePrefs } from '../../state/prefs';
import { pastDetailHours, type PastHour } from '../../core/model/pastDays';
import type { Day } from '../../core/model/types';
import { dayNames, t, ta, wmoText } from '../../core/i18n';

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
          {/* The same six figures the forecast sheet opens with, from the same
              component: a day is a day, and a reader moving between the two halves of
              the table should not have to learn a second layout to read one. */}
          <DaySummaryCells day={day} dayIndex={0} />

          <HourlyList layer="overview" hours={detail} sourceLabel={source} pastOnly />
        </Card>
      </ScrollView>
    </View>
  );
}
