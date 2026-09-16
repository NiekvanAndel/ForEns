/**
 * Verwachting — hourly detail, the 14-day list, and the source breakdown.
 *
 * The design's layer switcher is decorative in the mock; here each layer genuinely
 * re-renders the day rows against its own measurand, driven by `core/model/layers`.
 *
 * A tap on an hour in the strip on 'Nu' arrives here as a `day` route parameter and
 * opens that day's sheet, since this page owns the sheet and its hourly detail.
 *
 * Days 8–14 stay collapsed until asked for, because fetching them means a 16-day
 * deterministic run and a 14-day ensemble — the two slowest calls the app makes.
 *
 * ## The table starts before today
 *
 * The last two days sit above the forecast, in the same rows. A grower reads this page
 * to ask "how much rain did we get" at least as often as "how much are we getting",
 * and the answer used to be on another page in another shape.
 *
 * They are measurements where the location has an AgroExact station and Open-Meteo's
 * observation feed everywhere else — and per hour and per quantity, so a station that
 * lost its rain gauge still speaks for the temperature. `core/model/pastDays` builds
 * them as ordinary `Day` objects so the rows need to know nothing about any of it;
 * `usePastDays` does the fetching. The footnote names which of the two spoke, because
 * "2 mm fell" and "2 mm was modelled for you" are different claims.
 *
 * They are drawn back, so the table reads as a record behind a forecast rather than
 * as fourteen equal days. A full rule rather than the rows' soft hairline marks the
 * boundary, because that is the one line on this page a reader has to be able to find.
 *
 * ## Only on the overview, and into a sheet of their own
 *
 * The per-measurand tabs are about the ensemble: each row is a beam of where the
 * members fell with the reported value marked on it. A day that has happened has no
 * members, so it would be a lone dot on an empty track — saying less than the overview
 * row already says, in more space. The overview has no beam to leave empty, so that is
 * where the record lives.
 *
 * Tapping one opens `PastDaySheet` rather than `DaySheet`, for the same reason: what
 * is left of the forecast sheet once the ensemble is taken out of it is the day's
 * figures and its hours, which is a smaller sheet and a different one.
 *
 * The list is not in a card. A card inset the rows by the card's padding on both
 * sides and drew a border around content that already fills the page — width the
 * beams could use. Which model and how many days is a footnote at the bottom now,
 * not a header above it: it does not change, and it was reading as a title.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '../../theme';
import { usePagePadding } from '../../ui/layout';
import { Card, Rule } from '../../ui/Card';
import { TOP_BAR_CLEARANCE } from '../../ui/TopBar';
import { LocationTitle } from '../../ui/LocationTitle';
import { Text } from '../../ui/Text';
import { Icon } from '../../ui/Icon';
import { ScreenFrame } from '../../ui/ScreenFrame';
import { useRefreshControl } from '../../ui/useRefreshControl';
import { LayerSwitcher } from '../../ui/forecast/LayerSwitcher';
import { LayerDayRow } from '../../ui/forecast/LayerDayRow';
import { OverviewDayRow } from '../../ui/forecast/OverviewDayRow';
import { DaySheet } from '../../ui/forecast/DaySheet';
import { PastDaySheet } from '../../ui/forecast/PastDaySheet';
import { usePastDays } from '../../ui/forecast/usePastDays';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { useLocationStation } from '../../state/stations';
import { type LayerKey } from '../../core/model/layers';
import { beamScale, et0Scale } from '../../core/model/beam';
import { DayEnsembleCache, type DayEnsemble } from '../../core/sources/ensembleHourly';
import type { Day } from '../../core/model/types';
import { t, ta } from '../../core/i18n';
import { usePeeking } from '../../ui/peek';

/** Days shown before the user asks for the extended range. */
const COLLAPSED_DAYS = 7;

function ForecastPage() {
  const { palette } = useTheme();
  const { prefs, location } = usePrefs();
  const { model, phase, extendedLoaded, loadExtendedDays, offsetSec } = useForecast();
  const insets = useSafeAreaInsets();
  const pagePadding = usePagePadding();
  const router = useRouter();
  const peeking = usePeeking();
  const refreshControl = useRefreshControl();
  /** Set when another page asked for a particular day — the hourly strip on 'Nu'. */
  const { day: requestedDay } = useLocalSearchParams<{ day?: string }>();

  const [layer, setLayer] = useState<LayerKey>('overview');
  const [expanded, setExpanded] = useState(false);
  const [sheetDay, setSheetDay] = useState<Day | null>(null);
  /** A day that has already happened, opened from a row above the rule. Its own
   *  state, because it opens its own sheet — see `PastDaySheet`. */
  const [pastSheetDay, setPastSheetDay] = useState<Day | null>(null);
  const [dayEnsemble, setDayEnsemble] = useState<DayEnsemble | undefined>();
  const [ensembleLoading, setEnsembleLoading] = useState(false);
  // Kept across renders so reopening a sheet is instant, and cleared when the
  // location changes, since the same date elsewhere is a different forecast.
  const ensembleCache = useRef(new DayEnsembleCache());
  useEffect(() => {
    ensembleCache.current.clear();
  }, [location.lat, location.lon]);

  // The 51-member hourly series is far too large to hold for every day, so it is
  // fetched when a sheet opens and only for that date.
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

  // A day asked for by another page opens its sheet once the model that describes it
  // has landed, and the parameter is then cleared: it is a request, not a state, and
  // leaving it set would reopen the sheet every time the tab came back.
  useEffect(() => {
    // The request belongs to the page in front; a copy sliding past must not open a
    // sheet nobody can see, still less clear the parameter before it is read.
    if (peeking || !requestedDay || !model) return;
    const match = model.days.find((d) => d.date === requestedDay);
    if (match) setSheetDay(match);
    router.setParams({ day: undefined });
  }, [peeking, requestedDay, model, router]);

  const days = useMemo(
    () => (model ? (expanded ? model.days : model.days.slice(0, COLLAPSED_DAYS)) : []),
    [model, expanded]
  );

  // What has already happened, above what is coming. See `usePastDays`.
  const station = useLocationStation(location);
  const past = usePastDays({
    location,
    stationId: station?.id ?? null,
    offsetSec,
    lat: location.lat,
    enabled: !peeking,
  });

  /**
   * The past rows, which only the overview shows.
   *
   * The per-measurand tabs are about the ensemble: each row is a beam of where the
   * members fell with the reported value marked on it, and a day that has happened
   * has no members and no spread — it would be a lone dot on an empty track, saying
   * less than the overview row already says. The overview has no beam to leave empty,
   * so that is where the record belongs.
   */
  const pastRows = useMemo(
    () => (layer === 'overview' ? past.days : []),
    [layer, past.days]
  );

  // One scale across every day *shown*, so the column can be read down: a bar for
  // Monday and a bar for Thursday have to mean the same millimetres. Past days count
  // only where they are drawn, or a tab that hides them would still be scaled to fit
  // them and every bar on it would be short.
  const shown = useMemo(() => [...pastRows, ...days], [pastRows, days]);
  const scale = useMemo(() => beamScale(shown, layer, location.lat), [shown, layer, location.lat]);
  const et0Max = useMemo(() => et0Scale(shown), [shown]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadExtendedDays();
  };

  const modelLabel = model?.hresRunLabel
    ? `ECMWF ${model.hresRunLabel}`
    : 'ECMWF IFS';

  // Which of the two the rows above the rule came from, named rather than left to be
  // guessed: "2 mm fell" and "2 mm was modelled for you" are different claims.
  const pastLabel = `${pastRows.length} ${ta('pastDaysNote', prefs.lang)} · ${
    past.days.every((d) => d.pastMeasured)
      ? station?.name ?? ta('measured', prefs.lang)
      : ta('observations', prefs.lang)
  }`;

  return (
    <>
    <ScrollView
      contentContainerStyle={{
        ...pagePadding,
        paddingTop: TOP_BAR_CLEARANCE + insets.top,
        gap: space[3],
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      <LocationTitle />

      {!model ? (
        <Card>
          <View style={{ paddingVertical: space[8], alignItems: 'center' }}>
            {phase === 'error' ? (
              <Text variant="bodySm" color={palette.muted} align="center">
                {ta('noData', prefs.lang)}
              </Text>
            ) : (
              <ActivityIndicator color={palette.accent} />
            )}
          </View>
        </Card>
      ) : (
        <>
          <>
            <LayerSwitcher active={layer} onChange={setLayer} />

            <View>
              {/* The days that have happened, drawn back so they read as behind the
                  forecast rather than beside it. They open a sheet of their own: the
                  forecast's is built around the ensemble, and there is nothing
                  uncertain about a day that is over. */}
              {pastRows.map((d, i) => (
                <OverviewDayRow
                  key={d.date}
                  day={d}
                  dayIndex={0}
                  divider={i > 0}
                  subdued
                  onPress={() => setPastSheetDay(d)}
                />
              ))}

              {/* Where the record stops and the forecast starts. A full rule rather
                  than the soft hairline between rows, because that is the one
                  boundary on this page a reader has to be able to find. */}
              {pastRows.length ? <Rule style={{ marginVertical: space[1] }} /> : null}

              {days.map((d, i) =>
                // The overview tab is the web app's `overzicht`: every measurand at
                // once, so it has no single bar to draw and its own row instead.
                layer === 'overview' ? (
                  <OverviewDayRow
                    key={d.date}
                    day={d}
                    dayIndex={i}
                    divider={i > 0 || pastRows.length > 0}
                    onPress={() => setSheetDay(d)}
                  />
                ) : (
                  <LayerDayRow
                    key={d.date}
                    day={d}
                    dayIndex={i}
                    layer={layer}
                    scale={scale}
                    et0Max={et0Max}
                    divider={i > 0 || pastRows.length > 0}
                    onPress={() => setSheetDay(d)}
                  />
                )
              )}
            </View>

            <Rule soft style={{ marginTop: space[3] }} />
            <Pressable
              onPress={toggleExpanded}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 6, paddingVertical: space[3],
              }}
            >
              <Text variant="label" weight="semibold" color={palette.accentDark}>
                {expanded ? t('viewLess', prefs.lang) : t('viewMoreDays', prefs.lang)}
              </Text>
              {expanded && !extendedLoaded ? (
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

            <Text variant="caption" color={palette.muted} style={{ lineHeight: 18 }}>
              {expanded ? 14 : COLLAPSED_DAYS} dagen · {modelLabel}
              {pastRows.length ? `\n${pastLabel}` : ''}
              {'\n'}{ta('barsExplain', prefs.lang)}
            </Text>
          </>

        </>
      )}
    </ScrollView>

    <PastDaySheet
      visible={pastSheetDay != null}
      day={pastSheetDay}
      hours={past.hours}
      stationName={station?.name ?? null}
      onClose={() => setPastSheetDay(null)}
    />

    <DaySheet
      visible={sheetDay != null}
      day={sheetDay}
      model={model}
      ensemble={dayEnsemble}
      ensembleLoading={ensembleLoading}
      initialLayer={layer}
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
export default function ForecastScreen() {
  return <ScreenFrame page={ForecastPage} />;
}
