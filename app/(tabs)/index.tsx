/**
 * Nu — the main page.
 *
 * Order follows the design's README: conditional alert hero, conditions hero, the
 * short-term strip, radar preview, forecast, then the refreshed-at line.
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
import { TOP_BAR_CLEARANCE } from '../../ui/TopBar';
import { LocationTitle } from '../../ui/LocationTitle';
import { Card, CardHeader } from '../../ui/Card';
import { ScreenFrame } from '../../ui/ScreenFrame';
import { AlertHero } from '../../ui/nowcast/AlertHero';
import { ConditionsHero } from '../../ui/nowcast/ConditionsHero';
import { RadarPreview } from '../../ui/nowcast/RadarPreview';
import { HourSlider } from '../../ui/nowcast/HourSlider';
import { ForecastPreview } from '../../ui/nowcast/ForecastPreview';
import { DaySheet } from '../../ui/forecast/DaySheet';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { DayEnsembleCache, type DayEnsemble } from '../../core/sources/ensembleHourly';
import type { Day } from '../../core/model/types';
import { ta } from '../../core/i18n';

function NowcastPage() {
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

  /** An hour in the strip opens its day on 'Verwachting'. The sheet there carries
   *  the per-hour detail this strip only summarises, so the tap goes to the page
   *  that owns it rather than opening a second copy of the sheet here. */
  const openHourDay = useCallback(
    (hour: { time: string }) => {
      Haptics.selectionAsync().catch(() => {});
      router.push({ pathname: '/forecast', params: { day: hour.time.slice(0, 10) } });
    },
    [router]
  );

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
    <>
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: space[5],
        paddingTop: TOP_BAR_CLEARANCE + insets.top,
        paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
        gap: space[4],
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.muted} />
      }
    >
      <LocationTitle />

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

          {/* The next hours, as their own block: the hero says what it is doing
              now, this says what happens next, and a tap on an hour opens that
              day in 'Verwachting'. */}
          <Card pad={0}>
            <View style={{ paddingHorizontal: space[5], paddingTop: space[4] }}>
              <CardHeader icon="clock" label={ta('shortTerm', prefs.lang)} />
            </View>
            <HourSlider model={model} onPressHour={openHourDay} />
          </Card>

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
    </>
  );
}

/**
 * The route: the shared chrome, wrapped around the page above.
 *
 * `ScreenFrame` takes the component rather than its output, because the pager
 * behind it invokes one copy per location — see `LocationPager`.
 */
export default function NowcastScreen() {
  return <ScreenFrame page={NowcastPage} />;
}
