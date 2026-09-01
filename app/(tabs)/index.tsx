/**
 * Nu — the main page.
 *
 * Order follows the design's README: conditional alert hero, conditions hero, radar
 * preview, forecast, then the refreshed-at line.
 *
 * The forecast card is the web app's `overzicht` tab rather than a temperature
 * summary: every measurand for each of seven days, with the second week a tap away.
 * Tapping a day opens the same sheet 'Verwachting' opens, on its overview section.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { space, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { TAB_BAR_CLEARANCE } from '../../ui/GlassTabBar';
import { Card } from '../../ui/Card';
import { ScreenFrame } from '../../ui/ScreenFrame';
import { AlertHero } from '../../ui/nowcast/AlertHero';
import { ConditionsHero } from '../../ui/nowcast/ConditionsHero';
import { RadarPreview } from '../../ui/nowcast/RadarPreview';
import { ForecastPreview } from '../../ui/nowcast/ForecastPreview';
import { DaySheet } from '../../ui/forecast/DaySheet';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { DayEnsembleCache, type DayEnsemble } from '../../core/sources/ensembleHourly';
import type { Day } from '../../core/model/types';
import { ta } from '../../core/i18n';

export default function NowcastScreen() {
  const { palette } = useTheme();
  const { prefs, location } = usePrefs();
  const {
    model, alert, harmonie, phase, error, refresh, extendedLoaded, loadExtendedDays,
  } = useForecast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sheetDay, setSheetDay] = useState<Day | null>(null);
  const [dayEnsemble, setDayEnsemble] = useState<DayEnsemble | undefined>();
  const [ensembleLoading, setEnsembleLoading] = useState(false);
  const ensembleCache = useRef(new DayEnsembleCache());

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (phase !== 'loading') setRefreshing(false);
  }, [phase]);

  useEffect(() => {
    ensembleCache.current.clear();
  }, [location.lat, location.lon]);

  // The 51-member hourly series is too large to hold for every day, so it is fetched
  // when a sheet opens and only for that date.
  useEffect(() => {
    if (!sheetDay) return;
    const cached = ensembleCache.current.get(location.lat, location.lon, sheetDay.date);
    if (cached) {
      setDayEnsemble(cached);
      return;
    }
    let alive = true;
    setDayEnsemble(undefined);
    setEnsembleLoading(true);
    ensembleCache.current
      .load(location.lat, location.lon, sheetDay.date)
      .then((e) => { if (alive) setDayEnsemble(e); })
      .catch(() => { /* the sheet still renders, just without per-hour spread */ })
      .finally(() => { if (alive) setEnsembleLoading(false); });
    return () => { alive = false; };
  }, [sheetDay, location.lat, location.lon]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadExtendedDays();
  };

  const sourceLabel = location.stationName
    ? location.stationName
    : harmonie.model
      ? 'HARMONIE-AROME'
      : 'ECMWF IFS';

  const timeLabel = model ? model.nowHour.slice(11, 16) : '';

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
          gap: space[4],
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.muted} />
        }
      >
        {phase === 'error' ? (
          <Card>
            <Text variant="body" color={palette.muted} align="center">
              {error ?? ta('noData', prefs.lang)}
            </Text>
            <Pressable onPress={refresh} accessibilityRole="button" style={{ marginTop: space[4] }}>
              <Text variant="label" color={palette.accentDark} align="center">
                {ta('retry', prefs.lang)}
              </Text>
            </Pressable>
          </Card>
        ) : !model ? (
          <Card>
            <View style={{ paddingVertical: space[8], alignItems: 'center', gap: space[3] }}>
              <ActivityIndicator color={palette.accent} />
              <Text variant="bodySm" color={palette.muted}>
                {ta('shortTerm', prefs.lang)}…
              </Text>
            </View>
          </Card>
        ) : (
          <>
            <AlertHero alert={alert} />

            <ConditionsHero
              model={model}
              location={location}
              sourceLabel={sourceLabel}
              timeLabel={timeLabel}
            />

            <RadarPreview
              lat={location.lat}
              lon={location.lon}
              stationName={location.stationName}
              onOpen={() => router.push('/radar')}
            />

            <ForecastPreview
              model={model}
              onOpen={() => router.push('/forecast')}
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
              extendedLoading={!extendedLoaded}
              onOpenDay={setSheetDay}
            />

            <Text variant="caption" color={palette.muted} align="center">
              {ta('refreshedAt', prefs.lang)} {timeLabel}
              {model.hresRunLabel ? ` · ${model.hresRunLabel}` : ''}
            </Text>
          </>
        )}
      </ScrollView>

      <DaySheet
        visible={sheetDay != null}
        day={sheetDay}
        model={model}
        ensemble={dayEnsemble}
        ensembleLoading={ensembleLoading}
        initialLayer="overview"
        onClose={() => setSheetDay(null)}
      />
    </ScreenFrame>
  );
}
