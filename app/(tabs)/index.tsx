/**
 * Nowcast — the main page.
 *
 * Order follows the design's README: conditional alert hero, conditions hero, radar
 * preview, forecast preview, then the refreshed-at line.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { space, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { Card } from '../../ui/Card';
import { LocationBar } from '../../ui/LocationBar';
import { AlertHero } from '../../ui/nowcast/AlertHero';
import { ConditionsHero } from '../../ui/nowcast/ConditionsHero';
import { RadarPreview } from '../../ui/nowcast/RadarPreview';
import { ForecastPreview } from '../../ui/nowcast/ForecastPreview';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { searchPlaces, SEARCH_DEBOUNCE_MS, type Place } from '../../core/sources/geocoding';
import { ta } from '../../core/i18n';

/** Space the floating glass tab bar occupies, so content can scroll clear of it. */
const TAB_BAR_CLEARANCE = 110;

export default function NowcastScreen() {
  const { palette } = useTheme();
  const { prefs, location, addLocation } = usePrefs();
  const { model, alert, harmonie, phase, error, refresh } = useForecast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nominatim allows one request per second, so the query is debounced rather than
  // fired per keystroke.
  const onSearch = useCallback(
    (query: string) => {
      if (timer.current) clearTimeout(timer.current);
      if (!query.trim()) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      timer.current = setTimeout(() => {
        searchPlaces(query, prefs.lang)
          .then(setResults)
          .catch(() => setResults([]))
          .finally(() => setSearching(false));
      }, SEARCH_DEBOUNCE_MS);
    },
    [prefs.lang]
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (phase !== 'loading') setRefreshing(false);
  }, [phase]);

  const sourceLabel = location.stationName
    ? location.stationName
    : harmonie.model
      ? 'HARMONIE-AROME'
      : harmonie.failed
        ? 'ECMWF IFS'
        : 'ECMWF IFS';

  const timeLabel = model
    ? model.nowHour.slice(11, 16)
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: palette.appBg, paddingTop: insets.top }}>
      <LocationBar
        onSearch={onSearch}
        results={results}
        searching={searching}
        onPick={(p) =>
          addLocation({ name: p.name, lat: p.lat, lon: p.lon, sub: p.sub })
        }
      />

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

            <ForecastPreview model={model} onOpen={() => router.push('/forecast')} />

            <Text variant="caption" color={palette.muted} align="center">
              {ta('refreshedAt', prefs.lang)} {timeLabel}
              {model.hresRunLabel ? ` · ${model.hresRunLabel}` : ''}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
