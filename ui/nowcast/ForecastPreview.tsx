/**
 * The daily forecast card on 'Nu'.
 *
 * The web app's `overzicht` tab, not a temperature-only summary — icon, minimum,
 * maximum, wind, precipitation and sunshine on one line, seven days with the second
 * week a tap away. That is what the home page is for: everything about a day at a
 * glance, with 'Verwachting' for reading one measurand closely.
 *
 * The hourly slider that used to sit on top of this list moved into the hero, where
 * it follows on from the current reading instead of being a scroll away from it.
 */
import { View, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { space, useTheme } from '../../theme';
import { Card, CardHeader, Rule } from '../Card';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { OverviewDayRow } from '../forecast/OverviewDayRow';
import { usePrefs } from '../../state/prefs';
import { t, ta } from '../../core/i18n';
import type { Day, ForecastModel } from '../../core/model/types';

/** Days shown before the second week is asked for — the web app's split. */
const COLLAPSED_DAYS = 7;
export interface ForecastPreviewProps {
  model: ForecastModel;
  onOpen: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  /** True while the 14-day fetch is still in flight. */
  extendedLoading?: boolean;
  onOpenDay?: (day: Day) => void;
}

export function ForecastPreview({
  model, onOpen, expanded, onToggleExpanded, extendedLoading, onOpenDay,
}: ForecastPreviewProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const days = expanded ? model.days : model.days.slice(0, COLLAPSED_DAYS);

  return (
    <Card>
      <CardHeader
        icon="calendar-blank"
        label={ta('tabForecast', prefs.lang)}
        action={ta('details', prefs.lang)}
        onAction={onOpen}
      />

      <View>
        {days.map((d, i) => (
          <OverviewDayRow
            key={d.date}
            day={d}
            dayIndex={i}
            divider={i > 0}
            onPress={onOpenDay ? () => onOpenDay(d) : undefined}
          />
        ))}
      </View>

      <Rule soft />
      <Pressable
        onPress={onToggleExpanded}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          gap: 6, paddingTop: space[3],
        }}
      >
        <Text variant="label" weight="semibold" color={palette.accentDark}>
          {expanded ? t('viewLess', prefs.lang) : t('viewMoreDays', prefs.lang)}
        </Text>
        {expanded && extendedLoading ? (
          <ActivityIndicator size="small" color={palette.accentDark} />
        ) : (
          <Icon
            name={expanded ? 'arrow-up' : 'arrow-down'}
            size={13}
            color={palette.accentDark}
            weight="bold"
          />
        )}
      </Pressable>
    </Card>
  );
}
