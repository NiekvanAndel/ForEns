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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { space, useTheme } from '../../theme';
import { Columns, usePagePadding } from '../../ui/layout';
import { Text } from '../../ui/Text';
import { TOP_BAR_CLEARANCE } from '../../ui/TopBar';
import { LocationTitle } from '../../ui/LocationTitle';
import { Card } from '../../ui/Card';
import { ScreenFrame } from '../../ui/ScreenFrame';
import { useRefreshControl } from '../../ui/useRefreshControl';
import { AlertHero } from '../../ui/nowcast/AlertHero';
import { ConditionsHero } from '../../ui/nowcast/ConditionsHero';
import { SoilHero } from '../../ui/nowcast/SoilHero';
import { RadarPreview } from '../../ui/nowcast/RadarPreview';
import { HourSlider } from '../../ui/nowcast/HourSlider';
import { ForecastPreview } from '../../ui/nowcast/ForecastPreview';
import { DaySheet } from '../../ui/forecast/DaySheet';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { useLocationSoil } from '../../state/soilStations';
import { useLocationStation } from '../../state/stations';
import { waterTensionIndicator } from '../../core/model/indicators';
import { soilCapabilities } from '../../core/model/soil';
import { useDisease } from '../../state/disease';
import { DiseaseCard } from '../../ui/nowcast/DiseaseCard';
import { AdviceCard } from '../../ui/nowcast/AdviceCard';
import { ADVICE_FAMILIES, fieldAdvice } from '../../core/model/fieldAdvice';
import { enabledAdviceFamilies } from '../../core/prefs';
import { DayEnsembleCache, type DayEnsemble } from '../../core/sources/ensembleHourly';
import type { Day } from '../../core/model/types';
import { t, ta } from '../../core/i18n';
import { measurementTimeLabel } from '../../core/model/station';

function NowcastPage() {
  const { palette } = useTheme();
  const { prefs, location } = usePrefs();
  const {
    model, alert, harmonie, phase, error, refresh, extendedLoaded, loadExtendedDays,
    offsetSec,
  } = useForecast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  /**
   * Everything the field's card needs, or null on a place that is not one.
   *
   * No rainfall: that is weather, and it belongs on the weather card underneath, where
   * the sensor's own hours have already been merged in.
   */
  const soil = useLocationSoil(location, offsetSec);
  const station = useLocationStation(location);
  /**
   * The canopy readings, where a PRO stands at this location.
   *
   * Only a PRO has the probe — `soilCapabilities` is the authority on that, not
   * whether a value happens to be present — so a BASIC or a PLUS leaves the hero on
   * the model, which is the honest answer for a field with no thermometer in the crop.
   */
  const canopy = useMemo(() => {
    if (!soil.latest || !soilCapabilities(soil.station?.type).canopy) return null;
    if (soil.latest.temp10 == null && soil.latest.humidity10 == null) return null;
    return {
      temp: soil.latest.temp10,
      humidity: soil.latest.humidity10,
      label: ta('soilCanopyLabel', prefs.lang),
    };
  }, [soil.latest, soil.station?.type, prefs.lang]);

  /**
   * Smith, where the crop is potato and there is a probe in it.
   *
   * The crop comes from `/soilstations/` — a grower already told the web app what is
   * in this field — so the profile wizard is not in the way here. Only a PRO can
   * answer: a field has no weather station, and the model's own past hours reach about
   * a day back where Smith needs two.
   */
  /**
   * Every disease model that applies to what grows here.
   *
   * One hook for both instruments and both kinds of location — a field's own crop from
   * the API, a weather pole's several from the profile — so the card, the blocks on
   * 'Actueel' and the overview row cannot drift apart. See `state/disease`.
   */
  const disease = useDisease({
    station: station ?? null,
    sensor: soil.station,
    offsetSec,
  });

  /**
   * The rule-based advice for this location.
   *
   * Derived here rather than in a hook of its own: it needs nothing but the forecast
   * the page already has, and a family the reader switched off is never computed —
   * `enabledAdviceFamilies` decides what runs, not what is drawn.
   */
  const advice = useMemo(
    () => (model
      ? fieldAdvice({
        hours: model.futureHours,
        past: model.pastHours,
        days: model.days,
        nowKey: model.nowHour,
        families: enabledAdviceFamilies(ADVICE_FAMILIES, prefs.advice),
      })
      : []),
    [model, prefs.advice]
  );

  const soilHero = useMemo(() => {
    if (!soil.placement || !soil.latest || !model) return null;
    return {
      placement: soil.placement,
      latest: soil.latest,
      indicator: waterTensionIndicator([soil.latest], soil.placement, model.nowHour),
    };
  }, [soil.placement, soil.latest, model]);
  const pagePadding = usePagePadding();

  const [expanded, setExpanded] = useState(false);
  const [sheetDay, setSheetDay] = useState<Day | null>(null);
  const [dayEnsemble, setDayEnsemble] = useState<DayEnsemble | undefined>();
  const [ensembleLoading, setEnsembleLoading] = useState(false);
  const ensembleCache = useRef(new DayEnsembleCache());

  const refreshControl = useRefreshControl();

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

  // Where a station speaks for this location, the hero says so by name: the reader
  // should be able to tell an instrument down the road from a model over Europe.
  const stationName = model?.station?.name ?? location.stationName ?? null;
  const sourceLabel = model?.station
    ? `AgroExact - ${stationName ?? 'station'}`
    : harmonie.model
      ? 'HARMONIE-AROME'
      : 'ECMWF IFS';

  // A measurement carries its own timestamp, to the minute; a modelled hour does not.
  const measured = model?.station?.current;
  const timeLabel = measured
    ? measurementTimeLabel(measured.measTime, offsetSec)
    : model
      ? model.nowHour.slice(11, 16)
      : '';

  return (
    <>
    <ScrollView
      contentContainerStyle={{
        ...pagePadding,
        paddingTop: TOP_BAR_CLEARANCE + insets.top,
        gap: space[4],
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      <Columns spanning={2} spanningEnd={1}>
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
                {t('dataLoading', prefs.lang)}
              </Text>
            </View>
          </Card>
        ) : (
          <>
            <AlertHero alert={alert} />

            {/* On a field, the weather hero answers a question nobody asked: it leads
                with a temperature modelled for the region, and leaves out the one
                reading that decides today. So a field gets its own card, and the
                weather it needs is still two taps away on 'Actueel'. */}
            {/* A field leads with its own card, and the weather follows underneath.
                The first replaced the second at first, which threw away something a
                grower on a field still wants: the air over it. Two cards, in the order
                the questions are asked — how is the soil, and then what is the
                weather doing to it. */}
            {soilHero ? (
              <SoilHero
                name={location.name}
                placement={soilHero.placement}
                latest={soilHero.latest}
                indicator={soilHero.indicator}
              />
            ) : null}

            {/* What the weather has been doing to the crop. Under the field's own
                card, because the soil is what the page leads with and this is the
                consequence of the weather on top of it. */}
            <DiseaseCard pressure={disease} />

            {/* And what it means for the work: the spray window, frost, whether the
                land carries a machine, whether to spread. Under the disease card
                because that one is about the crop and this is about the day. */}
            <AdviceCard readings={advice} />

            <ConditionsHero
              model={model}
              location={location}
              sourceLabel={sourceLabel}
              timeLabel={timeLabel}
              // On a PRO the air in the crop is measured here, 10 cm up. Named on the
              // source line, never substituted silently: it is a different quantity
              // from the standard 1.50 m, not a better reading of the same one.
              canopy={canopy}
              // The card's own subject at full length. See `ConditionsHero`.
              onPress={() => router.push('/actueel')}
            />

            {/* The next hours, as their own block: the hero says what it is doing
                now, this says what happens next, and a tap on an hour opens that
                day in 'Verwachting'.

                No heading. It said "Korte termijn (0–2 uur)" over a strip that runs a
                day and a half in both directions, so it was wrong about the one thing
                a heading is for; and a row of hours labelled with their own times does
                not need to be told it is hours. */}
            <Card pad={0} style={{ paddingTop: space[4] }}>
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
      </Columns>
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
