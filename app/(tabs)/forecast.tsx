/**
 * Verwachting — hourly detail, the 14-day list, and the source breakdown.
 *
 * The design's layer switcher is decorative in the mock; here each layer genuinely
 * re-renders the day rows against its own measurand, driven by `core/model/layers`.
 *
 * Days 8–14 stay collapsed until asked for, because fetching them means a 16-day
 * deterministic run and a 14-day ensemble — the two slowest calls the app makes.
 *
 * The list is not in a card. A card inset the rows by the card's padding on both
 * sides and drew a border around content that already fills the page — width the
 * beams could use. Which model and how many days is a footnote at the bottom now,
 * not a header above it: it does not change, and it was reading as a title.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '../../theme';
import { Card, Rule } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { Icon } from '../../ui/Icon';
import { ScreenFrame } from '../../ui/ScreenFrame';
import { LayerSwitcher } from '../../ui/forecast/LayerSwitcher';
import { LayerDayRow } from '../../ui/forecast/LayerDayRow';
import { OverviewDayRow } from '../../ui/forecast/OverviewDayRow';
import { DaySheet } from '../../ui/forecast/DaySheet';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { type LayerKey } from '../../core/model/layers';
import { beamScale, et0Scale } from '../../core/model/beam';
import { DayEnsembleCache, type DayEnsemble } from '../../core/sources/ensembleHourly';
import type { Day } from '../../core/model/types';
import { t, ta } from '../../core/i18n';

const TAB_BAR_CLEARANCE = 110;
/** Days shown before the user asks for the extended range. */
const COLLAPSED_DAYS = 7;

export default function ForecastScreen() {
  const { palette } = useTheme();
  const { prefs, location } = usePrefs();
  const { model, phase, extendedLoaded, loadExtendedDays } = useForecast();
  const insets = useSafeAreaInsets();

  const [layer, setLayer] = useState<LayerKey>('overview');
  const [expanded, setExpanded] = useState(false);
  const [sheetDay, setSheetDay] = useState<Day | null>(null);
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

  const days = useMemo(
    () => (model ? (expanded ? model.days : model.days.slice(0, COLLAPSED_DAYS)) : []),
    [model, expanded]
  );

  // One scale across every day shown, so the column can be read down.
  const scale = useMemo(() => beamScale(days, layer, location.lat), [days, layer, location.lat]);
  const et0Max = useMemo(() => et0Scale(days), [days]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadExtendedDays();
  };

  const modelLabel = model?.hresRunLabel
    ? `ECMWF ${model.hresRunLabel}`
    : 'ECMWF IFS';

  return (
    <ScreenFrame compactTitle>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[4],
          paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
          gap: space[3],
        }}
        showsVerticalScrollIndicator={false}
      >
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
                {days.map((d, i) =>
                  // The overview tab is the web app's `overzicht`: every measurand at
                  // once, so it has no single bar to draw and its own row instead.
                  layer === 'overview' ? (
                    <OverviewDayRow
                      key={d.date}
                      day={d}
                      dayIndex={i}
                      divider={i > 0}
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
                      divider={i > 0}
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
                {'\n'}{ta('barsExplain', prefs.lang)}
              </Text>
            </>

          </>
        )}
      </ScrollView>

      <DaySheet
        visible={sheetDay != null}
        day={sheetDay}
        model={model}
        ensemble={dayEnsemble}
        ensembleLoading={ensembleLoading}
        initialLayer={layer}
        onClose={() => setSheetDay(null)}
      />
    </ScreenFrame>
  );
}
