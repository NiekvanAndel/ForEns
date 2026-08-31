/**
 * Radar — the full map with its timeline.
 *
 * Follows the design's RadarScreen: a tall map with the own-position ping, station
 * pins, zoom controls, a time badge and a legend, then a card carrying play/scrub
 * and the nowcast summary.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadowFloat, space, useTheme } from '../../theme';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { Icon } from '../../ui/Icon';
import { ScreenFrame } from '../../ui/ScreenFrame';
import { RadarMap } from '../../ui/radar/RadarMap';
import { Timeline } from '../../ui/radar/Timeline';
import { FullScreenRadar } from '../../ui/radar/FullScreenRadar';
import { NowcastPanel } from '../../ui/radar/NowcastPanel';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { useStations, stationsNear } from '../../state/stations';
import { activeProvider, frameLabel, type RadarFrame } from '../../core/radar';
import { mapChrome } from '../../ui/radar/mapStyle';
import { fmtMm, ta } from '../../core/i18n';

const TAB_BAR_CLEARANCE = 110;
/** The map takes as much of the page as it can. Taller than wide, because a shower
 *  track is usually read north-to-south here, and because the panel beneath it is
 *  short. */
const MAP_ASPECT = 0.62;
/** Station pins are drawn for this radius around the location. */
const STATION_PIN_RADIUS_KM = 60;

export default function RadarScreen() {
  const { palette, appearance } = useTheme();
  const { prefs, location } = usePrefs();
  const { nowcast } = useForecast();
  const insets = useSafeAreaInsets();
  const { stations } = useStations(location.lat, location.lon);
  const chrome = mapChrome(palette, appearance);

  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fullScreen, setFullScreen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(320);

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

  const pins = useMemo(
    () => stationsNear(stations, location.lat, location.lon, STATION_PIN_RADIUS_KM),
    [stations, location.lat, location.lon]
  );

  const wet = nowcast?.wet ?? false;
  const summary = wet
    ? `${ta('showerOver', prefs.lang)} ${location.name} — ${fmtMm(nowcast?.totalMm ?? 0)} mm ${ta('expected', prefs.lang)}`
    : `${ta('dryAt', prefs.lang)} ${location.name}`;

  return (
    <ScreenFrame compactTitle>
      <ScrollView
        onLayout={(e) => setPanelWidth(Math.max(1, e.nativeEvent.layout.width - space[5] * 4))}
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
          gap: space[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <RadarMap
            lat={location.lat}
            lon={location.lon}
            frames={frames}
            activeIndex={index}
            stations={pins}
            timeLabel={frames.length ? frameLabel(frames[index]) : '—'}
            style={{ aspectRatio: MAP_ASPECT }}
          />
          <Pressable
            onPress={() => setFullScreen(true)}
            accessibilityRole="button"
            accessibilityLabel={ta('fullScreen', prefs.lang)}
            hitSlop={8}
            style={[
              {
                position: 'absolute', right: 14, bottom: 14,
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: chrome.bg,
                alignItems: 'center', justifyContent: 'center',
              },
              shadowFloat,
            ]}
          >
            <Icon name="arrows-out" size={17} color={chrome.ink} weight="bold" />
          </Pressable>
        </View>

        <Card pad={0}>
          <NowcastPanel
            profile={nowcast}
            offsetMin={frames[index] ? Math.round((frames[index]!.timeMs - Date.now()) / 60_000) : 0}
            width={panelWidth}
            compact
          />
        </Card>

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

      <FullScreenRadar
        visible={fullScreen}
        onClose={() => setFullScreen(false)}
        lat={location.lat}
        lon={location.lon}
        frames={frames}
        activeIndex={index}
        onScrub={setIndex}
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        stations={pins}
        profile={nowcast}
      />
    </ScreenFrame>
  );
}
