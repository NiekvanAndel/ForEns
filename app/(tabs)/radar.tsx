/**
 * Radar — the map, its profile, and its timeline.
 *
 * Almost all of the page is map, because the map is the reason to be here. What sits
 * under it is one card, not three: the precipitation profile at this location and
 * the scrubber that drives the loop, with the chart's cursor tracking the scrubber
 * so the two read as one control.
 *
 * The prose summary, the legend, the location title and the timeline's own labels
 * are all gone from this page. Each was a line of text where the map wanted height,
 * and each is still available — the summary on 'Nu', the rest in full screen.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadowFloat, space, useTheme } from '../../theme';
import { Card } from '../../ui/Card';
import { TAB_BAR_CLEARANCE } from '../../ui/GlassTabBar';
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
import { activeProvider, frameClock, radarAxis, type RadarFrame } from '../../core/radar';
import { mapChrome } from '../../ui/radar/mapStyle';
import { ta } from '../../core/i18n';

/** The map takes as much of the page as it can. Taller than wide, because a shower
 *  track is usually read north-to-south here, and because the panel beneath it is
 *  short. */
const MAP_ASPECT = 0.78;
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

  // One axis for the chart and the scrubber, so the cursor and the thumb move
  // together, and it spans the frames alone so the curve covers what the map can
  // actually show. See `radarAxis`.
  const axis = radarAxis(frames);
  const offsetMin = frames[index]
    ? Math.round((frames[index]!.timeMs - Date.now()) / 60_000)
    : 0;

  /** A position along the shared axis, back to the frame nearest it. */
  const scrubTo = (fraction: number) => {
    if (!axis) return;
    let best = 0;
    let bestDistance = Infinity;
    axis.positions.forEach((p, i) => {
      const d = Math.abs(p - fraction);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });
    setIndex(best);
  };

  return (
    <ScreenFrame hideTitle>
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
            timeLabel={frameClock(frames[index])}
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
          {loading ? (
            <View style={{ paddingVertical: space[6], alignItems: 'center' }}>
              <ActivityIndicator color={palette.accent} />
            </View>
          ) : frames.length ? (
            <>
              <NowcastPanel
                profile={nowcast}
                offsetMin={offsetMin}
                width={panelWidth}
                domain={axis ? { from: axis.from, to: axis.to } : undefined}
                locationName={location.name}
                onScrubFraction={scrubTo}
                compact
              />
              <View style={{ paddingHorizontal: space[5], paddingBottom: space[4] }}>
                <Timeline
                  frames={frames}
                  index={index}
                  playing={playing}
                  onIndexChange={setIndex}
                  onTogglePlay={() => setPlaying((p) => !p)}
                  showLabels={false}
                  stepPositions={axis?.positions}
                />
              </View>
            </>
          ) : (
            <View style={{ padding: space[6] }}>
              <Text variant="bodySm" color={palette.muted} align="center">
                Radarbeelden zijn tijdelijk niet beschikbaar.
              </Text>
            </View>
          )}
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
        locationName={location.name}
      />
    </ScreenFrame>
  );
}
