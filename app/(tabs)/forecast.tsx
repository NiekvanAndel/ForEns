/**
 * Verwachting — hourly detail, the 14-day list, and the source breakdown.
 *
 * The design's layer switcher is decorative in the mock; here each layer genuinely
 * re-renders the day rows against its own measurand, driven by `core/model/layers`.
 *
 * Days 8–14 stay collapsed until asked for, because fetching them means a 16-day
 * deterministic run and a 14-day ensemble — the two slowest calls the app makes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '../../theme';
import { Card, CardHeader, Rule } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { Icon } from '../../ui/Icon';
import { LocationBar } from '../../ui/LocationBar';
import { HourStrip } from '../../ui/forecast/HourStrip';
import { LayerSwitcher } from '../../ui/forecast/LayerSwitcher';
import { LayerDayRow } from '../../ui/forecast/LayerDayRow';
import { DaySheet } from '../../ui/forecast/DaySheet';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { layerScale, type LayerKey } from '../../core/model/layers';
import { DayEnsembleCache, type DayEnsemble } from '../../core/sources/ensembleHourly';
import type { Day } from '../../core/model/types';
import { searchPlaces, SEARCH_DEBOUNCE_MS, type Place } from '../../core/sources/geocoding';
import { t, ta } from '../../core/i18n';

const TAB_BAR_CLEARANCE = 110;
/** Days shown before the user asks for the extended range. */
const COLLAPSED_DAYS = 7;

export default function ForecastScreen() {
  const { palette } = useTheme();
  const { prefs, location, addLocation } = usePrefs();
  const { model, harmonie, phase, extendedLoaded, loadExtendedDays } = useForecast();
  const insets = useSafeAreaInsets();

  const [layer, setLayer] = useState<LayerKey>('precip');
  const [expanded, setExpanded] = useState(false);
  const [sheetDay, setSheetDay] = useState<Day | null>(null);
  const [dayEnsemble, setDayEnsemble] = useState<DayEnsemble | undefined>();
  const [ensembleLoading, setEnsembleLoading] = useState(false);
  // Kept across renders so reopening a sheet is instant, and cleared when the
  // location changes, since the same date elsewhere is a different forecast.
  const ensembleCache = useRef(new DayEnsembleCache());
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);

  const onSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      setTimeout(() => {
        searchPlaces(query, prefs.lang)
          .then(setResults)
          .catch(() => setResults([]))
          .finally(() => setSearching(false));
      }, SEARCH_DEBOUNCE_MS);
    },
    [prefs.lang]
  );

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
  const scale = useMemo(
    () => layerScale(days, layer, prefs.showSpread),
    [days, layer, prefs.showSpread]
  );

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadExtendedDays();
  };

  const modelLabel = model?.hresRunLabel
    ? `ECMWF ${model.hresRunLabel}`
    : 'ECMWF IFS';
  const shortTermSource = harmonie.model
    ? `HARMONIE-AROME ${harmonie.model === 'netherlands' ? 'NL' : 'EU'}`
    : 'ECMWF IFS';

  return (
    <View style={{ flex: 1, backgroundColor: palette.appBg, paddingTop: insets.top }}>
      <LocationBar
        onSearch={onSearch}
        results={results}
        searching={searching}
        onPick={(p) => addLocation({ name: p.name, lat: p.lat, lon: p.lon, sub: p.sub })}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
          gap: space[4],
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
            <Card>
              <CardHeader icon="clock" label={t('shortTermDetail', prefs.lang)} />
              <HourStrip hours={model.futureHours.slice(0, 24)} />
            </Card>

            <Card>
              <CardHeader
                icon="calendar-blank"
                label={`${expanded ? 14 : COLLAPSED_DAYS} dagen · ${modelLabel}`}
              />
              <LayerSwitcher active={layer} onChange={setLayer} />

              <View style={{ gap: 2 }}>
                {days.map((d) => (
                  <LayerDayRow
                    key={d.date}
                    day={d}
                    layer={layer}
                    scale={scale}
                    showSpread={prefs.showSpread}
                    onPress={() => setSheetDay(d)}
                  />
                ))}
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
                {ta('barsExplain', prefs.lang)}
              </Text>
            </Card>

            <Card>
              <CardHeader icon="info" label={ta('source', prefs.lang)} />
              <View style={{ gap: 10 }}>
                <SourceRow
                  label={ta('shortTerm', prefs.lang)}
                  value={
                    ta('nowcastRadar', prefs.lang) +
                    (location.stationId ? ta('withStation', prefs.lang) : '')
                  }
                />
                <SourceRow label={ta('midTerm', prefs.lang)} value={shortTermSource} />
                <SourceRow
                  label={ta('longTerm', prefs.lang)}
                  value={`${modelLabel}${model.nMembers > 1 ? ` · ${model.nMembers} leden` : ''}`}
                  last
                />
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      <DaySheet
        visible={sheetDay != null}
        day={sheetDay}
        model={model}
        ensemble={dayEnsemble}
        ensembleLoading={ensembleLoading}
        onClose={() => setSheetDay(null)}
      />
    </View>
  );
}

function SourceRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row', justifyContent: 'space-between',
        gap: space[4], alignItems: 'baseline',
        paddingBottom: last ? 0 : space[2],
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.hairlineSoft,
      }}
    >
      <Text variant="label" weight="regular" color={palette.muted} style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <Text
        variant="label"
        weight="bold"
        color={palette.inkHeading}
        align="right"
        style={{ flexShrink: 1 }}
      >
        {value}
      </Text>
    </View>
  );
}
