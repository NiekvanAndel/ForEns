/**
 * Radar — the full map with its timeline.
 *
 * Follows the design's RadarScreen: a tall map with the own-position ping, station
 * pins, zoom controls, a time badge and a legend, then a card carrying play/scrub
 * and the nowcast summary.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '../../theme';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { Icon } from '../../ui/Icon';
import { LocationBar } from '../../ui/LocationBar';
import { RadarMap } from '../../ui/radar/RadarMap';
import { Timeline } from '../../ui/radar/Timeline';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { useStations, stationsNear } from '../../state/stations';
import { activeProvider, frameLabel, type RadarFrame } from '../../core/radar';
import { searchPlaces, SEARCH_DEBOUNCE_MS, type Place } from '../../core/sources/geocoding';
import { fmtMm, ta } from '../../core/i18n';

const TAB_BAR_CLEARANCE = 110;
/** Station pins are drawn for this radius around the location. */
const STATION_PIN_RADIUS_KM = 60;

export default function RadarScreen() {
  const { palette } = useTheme();
  const { prefs, location, addLocation } = usePrefs();
  const { nowcast } = useForecast();
  const insets = useSafeAreaInsets();
  const { stations } = useStations(location.lat, location.lon);

  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setLoading(true);
    activeProvider()
      .listFrames(ctrl.signal)
      .then((f) => {
        if (!alive) return;
        const all = [...f.past, ...f.forecast];
        setFrames(all);
        // Open on the latest observation, not on the oldest frame or a forecast.
        setIndex(Math.max(0, f.past.length - 1));
      })
      .catch(() => { if (alive) setFrames([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, []);

  const onSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      const id = setTimeout(() => {
        searchPlaces(query, prefs.lang)
          .then(setResults)
          .catch(() => setResults([]))
          .finally(() => setSearching(false));
      }, SEARCH_DEBOUNCE_MS);
      return () => clearTimeout(id);
    },
    [prefs.lang]
  );

  const pins = useMemo(
    () => stationsNear(stations, location.lat, location.lon, STATION_PIN_RADIUS_KM),
    [stations, location.lat, location.lon]
  );

  const wet = nowcast?.wet ?? false;
  const summary = wet
    ? `${ta('showerOver', prefs.lang)} ${location.name} — ${fmtMm(nowcast?.totalMm ?? 0)} mm ${ta('expected', prefs.lang)}`
    : `${ta('dryAt', prefs.lang)} ${location.name}`;

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
        <RadarMap
          lat={location.lat}
          lon={location.lon}
          frames={frames}
          activeIndex={index}
          stations={pins}
          timeLabel={frames.length ? frameLabel(frames[index]) : '—'}
          style={{ aspectRatio: 3 / 4 }}
        />

        <Card>
          {loading ? (
            <View style={{ paddingVertical: space[5], alignItems: 'center' }}>
              <ActivityIndicator color={palette.accent} />
            </View>
          ) : frames.length ? (
            <Timeline
              frames={frames}
              index={index}
              playing={playing}
              onIndexChange={setIndex}
              onTogglePlay={() => setPlaying((p) => !p)}
            />
          ) : (
            <Text variant="bodySm" color={palette.muted} align="center">
              Radarbeelden zijn tijdelijk niet beschikbaar.
            </Text>
          )}

          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: space[2],
              marginTop: space[4],
            }}
          >
            <View
              style={{
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: wet ? palette.statusHeavy : palette.statusDry,
                borderWidth: wet ? 0 : 1,
                borderColor: palette.statusDryEdge,
              }}
            />
            <Text variant="bodySm" weight="semibold" color={palette.inkHeading} style={{ flex: 1 }}>
              {summary}
            </Text>
          </View>

          <Text variant="caption" color={palette.muted} style={{ marginTop: 7 }}>
            {ta('nowcastFrom', prefs.lang)}
            {pins.length ? ` ${ta('andStations', prefs.lang)}` : ''}.
            {nowcast ? ` ${ta('certainty', prefs.lang)} ${nowcast.confidence}%.` : ''}
          </Text>
        </Card>

        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], justifyContent: 'center' }}
        >
          <Icon name="arrows-clockwise" size={13} color={palette.muted} />
          <Text variant="caption" color={palette.muted}>
            {ta('refreshEvery5', prefs.lang)}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
