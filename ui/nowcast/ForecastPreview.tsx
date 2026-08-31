/**
 * The forecast card on 'Nu': an hourly strip and the daily overview.
 *
 * The daily list is the web app's `overzicht` tab, not a temperature-only summary —
 * icon, minimum, maximum, wind, precipitation and sunshine on one line, seven days
 * with the second week a tap away. That is what the home page is for: everything
 * about a day at a glance, with 'Verwachting' for reading one measurand closely.
 *
 * The strip carries past hours too and opens on the current one, so the morning is
 * a swipe left rather than a different screen.
 */
import { View, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, space, useTheme } from '../../theme';
import { Card, CardHeader, Rule } from '../Card';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { WeatherIcon } from '../WeatherIcon';
import { OverviewDayRow } from '../forecast/OverviewDayRow';
import { currentHourDecor, plainDecor } from '../forecast/currentHour';
import { useCenterOnIndex } from '../forecast/useCenterOnIndex';
import { usePrefs } from '../../state/prefs';
import { convTemp, fmtMm, t, ta } from '../../core/i18n';
import { hourWindow } from '../../core/model/hourWindow';
import type { Day, ForecastModel } from '../../core/model/types';

/** Days shown before the second week is asked for — the web app's split. */
const COLLAPSED_DAYS = 7;
const CELL_WIDTH = 62;
const CELL_GAP = 6;
const PAST_OPACITY = 0.45;

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
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const { hours, nowIndex } = hourWindow(model, { ahead: 12, behind: 6 });
  const days = expanded ? model.days : model.days.slice(0, COLLAPSED_DAYS);
  const maxMm = Math.max(...hours.map((h) => h.precip ?? 0), 1);
  const decor = currentHourDecor(palette, appearance);
  const { ref, onLayout } = useCenterOnIndex(nowIndex, CELL_WIDTH, CELL_GAP);

  return (
    <Card>
      <CardHeader
        icon="clock"
        label={ta('tabForecast', prefs.lang)}
        action={ta('details', prefs.lang)}
        onAction={onOpen}
      />

      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={onLayout}
        contentContainerStyle={{ gap: CELL_GAP, paddingBottom: 4 }}
      >
        {hours.map((h, i) => {
          const mm = h.precip ?? 0;
          return (
            <View
              key={h.time}
              style={[
                {
                  width: CELL_WIDTH, alignItems: 'center', borderRadius: radius.tile + 2,
                  paddingVertical: 10, paddingHorizontal: 4,
                  opacity: i < nowIndex ? PAST_OPACITY : 1,
                },
                i === nowIndex ? decor : plainDecor,
              ]}
            >
              <Text variant="caption" weight="semibold" color={palette.muted} tabular>
                {h.time.slice(11, 16)}
              </Text>
              <View style={{ marginVertical: 7 }}>
                <WeatherIcon wmo={h.wmo} isDay={h.isDay} size={22} />
              </View>
              <Text variant="bodySm" weight="bold" color={palette.valTemp} tabular>
                {convTemp(h.temp, prefs.tempUnit) ?? '—'}°
              </Text>
              <View style={{ height: 30, justifyContent: 'flex-end', marginTop: 6 }}>
                {mm > 0 ? (
                  <LinearGradient
                    colors={[palette.sky, palette.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{ width: 16, height: Math.max(3, (mm / maxMm) * 30), borderRadius: 3 }}
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
                style={{ fontSize: 11, marginTop: 5 }}
              >
                {fmtMm(mm)}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <Rule style={{ marginTop: space[3] }} />
      <View style={{ paddingTop: space[2] }}>
        {days.map((d, i) => (
          <OverviewDayRow
            key={d.date}
            day={d}
            dayIndex={i}
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
