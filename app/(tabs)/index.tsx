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
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { space, useTheme } from '../../theme';
import { Columns, usePagePadding } from '../../ui/layout';
import { Text } from '../../ui/Text';
import { TOP_BAR_CLEARANCE } from '../../ui/TopBar';
import { LocationTitle } from '../../ui/LocationTitle';
import { Icon } from '../../ui/Icon';
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
import { useLocationAdvice } from '../../state/advice';
import { TileEditor } from '../../ui/current/TileEditor';
import { arrangeNowCards, NOW_CARDS } from '../../core/nowCards';
import type { AppStringKey } from '../../core/i18n';
import { DayEnsembleCache, type DayEnsemble } from '../../core/sources/ensembleHourly';
import type { Day } from '../../core/model/types';
import { t, ta } from '../../core/i18n';
import { measurementTimeLabel } from '../../core/model/station';

/**
 * What each card is called, in the editor's list.
 *
 * Reusing the overview page's names rather than minting a second set: the hero on
 * this page and the `hero` widget over there are the same card, and a reader who has
 * arranged both should not have to learn two words for it.
 */
const CARD_LABEL: Record<string, AppStringKey> = {
  alert: 'alertBlocks',
  soil: 'ovSoil',
  conditions: 'ovHero',
  hours: 'ovNearTerm',
  radar: 'ovRadar',
  forecast: 'ovLongTerm',
  disease: 'diseaseTitle',
  advice: 'adviceTitle',
};

function NowcastPage() {
  const { palette } = useTheme();
  const { prefs, location, setPrefs } = usePrefs();
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

  /** The same readings the blocks on 'Actueel' draw — see `state/advice`. */
  const advice = useLocationAdvice();

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
  const [editing, setEditing] = useState(false);
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

  /**
   * Every card this page can draw, by the id `core/nowCards` knows it as.
   *
   * A map rather than a stack of JSX, because the order is the reader's now — see
   * `arrangeNowCards`. The cards that have nothing to say still return null on their
   * own (no alert, no field, no models that apply), so an id present here is not a
   * promise that anything is drawn.
   */
  const cards: Record<string, React.ReactNode> = {
    alert: <AlertHero alert={alert} />,

    // On a field, the weather hero answers a question nobody asked: it leads with a
    // temperature modelled for the region and leaves out the one reading that decides
    // today. So a field gets its own card, and the weather it needs is underneath —
    // two cards, in the order the questions are asked.
    soil: soilHero ? (
      <SoilHero
        name={location.name}
        placement={soilHero.placement}
        latest={soilHero.latest}
        indicator={soilHero.indicator}
      />
    ) : null,

    // What the weather has been doing to the crop, and what it means for the work.
    // Last in the natural order: they are conclusions drawn from the readings above
    // them, and a page that opens on four verdicts serves a grower in April and
    // nobody in November. Two gestures in the editor put them on top for good.
    disease: <DiseaseCard pressure={disease} />,
    advice: <AdviceCard readings={advice} />,

    conditions: model ? (
      <ConditionsHero
        model={model}
        location={location}
        sourceLabel={sourceLabel}
        timeLabel={timeLabel}
        // On a PRO the air in the crop is measured here, 10 cm up. Named on the
        // source line, never substituted silently: it is a different quantity from
        // the standard 1.50 m, not a better reading of the same one.
        canopy={canopy}
        // The card's own subject at full length. See `ConditionsHero`.
        onPress={() => router.push('/actueel')}
      />
    ) : null,

    // The next hours. No heading: it said "Korte termijn (0–2 uur)" over a strip
    // that runs a day and a half in both directions, and a row of hours labelled
    // with their own times does not need to be told it is hours.
    hours: model ? (
      <Card pad={0} style={{ paddingTop: space[4] }}>
        <HourSlider model={model} onPressHour={openHourDay} />
      </Card>
    ) : null,

    radar: (
      <RadarPreview
        lat={location.lat}
        lon={location.lon}
        stationName={location.stationName}
        onOpen={() => router.push('/radar')}
      />
    ),

    forecast: model ? (
      <ForecastPreview
        model={model}
        onOpen={() => router.push('/forecast')}
        expanded={expanded}
        onToggleExpanded={toggleExpanded}
        extendedLoading={!extendedLoaded}
        onOpenDay={setSheetDay}
      />
    ) : null,
  };

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
        <LocationTitle
          action={
            model ? (
              <Pressable
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setEditing(true); }}
                accessibilityRole="button"
                accessibilityLabel={ta('nowCards', prefs.lang)}
                hitSlop={10}
              >
                <Icon name="pencil-simple" size={16} color={palette.muted} />
              </Pressable>
            ) : null
          }
        />

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
            {/* A fragment rather than a wrapper: the scroll's own `gap` spaces the
                cards, and a wrapping view around a card that draws nothing would
                leave a gap where the card is not. */}
            {arrangeNowCards(prefs.nowCards).map((card) => (
              <Fragment key={card.id}>{cards[card.id] ?? null}</Fragment>
            ))}

            <Text variant="caption" color={palette.muted} align="center">
              {ta('refreshedAt', prefs.lang)} {timeLabel}
              {model.hresRunLabel ? ` · ${model.hresRunLabel}` : ''}
            </Text>
          </>
        )}
      </Columns>
    </ScrollView>

    <TileEditor
      visible={editing}
      onClose={() => setEditing(false)}
      title={ta('nowCards', prefs.lang)}
      hint={ta('nowCardsHint', prefs.lang)}
      all={NOW_CARDS.map((c) => ({
        id: c.id,
        title: ta(CARD_LABEL[c.id] ?? 'ovHero', prefs.lang),
      }))}
      layout={prefs.nowCards}
      onChange={(next) => setPrefs({ nowCards: next(prefs.nowCards) })}
    />

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
