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
 * and each is still available — the summary on 'Nu', the rest on the map page.
 *
 * ## The full-screen button is a shortcut now, not an owner
 *
 * It used to present the full-screen map as a modal this page owned, which made the
 * top row's map button reach the map by routing *to this tab* with a parameter
 * telling it to open that modal. So a button about the map depended on a page about
 * the radar. Now the map is `app/map.tsx` and this button pushes it, exactly as the
 * top row's does. The location does not have to be handed over: it is the selected
 * one, and both pages read the same selection.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadowFloat, space, useTheme } from '../../theme';
import { Card } from '../../ui/Card';
import { TAB_BAR_CLEARANCE } from '../../ui/GlassTabBar';
import { TOP_BAR_CLEARANCE } from '../../ui/TopBar';
import { Text } from '../../ui/Text';
import { Icon } from '../../ui/Icon';
import { ScreenFrame } from '../../ui/ScreenFrame';
import { useRefreshControl } from '../../ui/useRefreshControl';
import { RadarMap } from '../../ui/radar/RadarMap';
import { Timeline } from '../../ui/radar/Timeline';
import { frameAtFraction, useRadarFrames } from '../../ui/radar/useRadarFrames';
import { NowcastPanel } from '../../ui/radar/NowcastPanel';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { activeProvider, forecastBoundary, frameClock, radarAxis } from '../../core/radar';
import { mapChrome } from '../../ui/radar/mapStyle';
import { usePeeking } from '../../ui/peek';
import { ta } from '../../core/i18n';

/** The map takes as much of the page as it can. Taller than wide, because a shower
 *  track is usually read north-to-south here, and because the panel beneath it is
 *  short. */
const MAP_ASPECT = 0.78;

function RadarPage() {
  const { palette, appearance } = useTheme();
  const { prefs, location } = usePrefs();
  const { nowcast } = useForecast();
  const insets = useSafeAreaInsets();
  const peeking = usePeeking();
  const router = useRouter();
  const chrome = mapChrome(palette, appearance);

  const { frames, index, setIndex, playing, togglePlay, loading, fetch: fetchFrames } =
    useRadarFrames();
  const [panelWidth, setPanelWidth] = useState(320);

  // The radar run covers the Netherlands, Belgium and western Germany. A saved
  // location outside it gets a sentence rather than an empty chart under a map
  // whose pictures do not reach it.
  const covered = activeProvider().coversPoint(location.lat, location.lon);

  useEffect(() => {
    // A copy of this page sliding past draws a still panel where the map goes, so
    // the frames behind it would be fetched for something never shown.
    if (peeking) return;
    const ctrl = new AbortController();
    fetchFrames(ctrl.signal);
    return () => ctrl.abort();
  }, [peeking, fetchFrames]);

  // The forecast context reloads the nowcast profile under the panel; the frames
  // are this page's own, so the pull waits for them too.
  const refreshControl = useRefreshControl(
    useCallback(() => fetchFrames(undefined, false), [fetchFrames])
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
    const at = frameAtFraction(axis?.positions, fraction);
    if (at != null) setIndex(at);
  };

  return (
    <ScrollView
      onLayout={(e) => setPanelWidth(Math.max(1, e.nativeEvent.layout.width - space[5] * 4))}
      contentContainerStyle={{
        paddingHorizontal: space[5],
        paddingTop: TOP_BAR_CLEARANCE + insets.top,
        paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
        gap: space[4],
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      <View>
        <RadarMap
          lat={location.lat}
          lon={location.lon}
          frames={frames}
          activeIndex={index}
          timeLabel={frameClock(frames[index])}
          style={{ aspectRatio: MAP_ASPECT }}
        />
        <Pressable
          onPress={() => router.push('/map')}
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
        ) : !covered ? (
          <View style={{ padding: space[6] }}>
            <Text variant="bodySm" color={palette.muted} align="center">
              {ta('radarOutside', prefs.lang)}
            </Text>
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
              boundaryFraction={forecastBoundary(frames, axis?.positions)}
              playing={playing}
              onTogglePlay={togglePlay}
              playDisabled={frames.length < 2}
              compact
            />
            <View style={{ paddingHorizontal: space[5], paddingBottom: space[4] }}>
              <Timeline
                frames={frames}
                index={index}
                playing={playing}
                onIndexChange={setIndex}
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
  );
}

/**
 * The route: the shared chrome, wrapped around the page above.
 *
 * `ScreenFrame` takes the component rather than its output, because the pager
 * behind it invokes one copy per location — see `LocationPager`.
 */
export default function RadarScreen() {
  return <ScreenFrame page={RadarPage} />;
}
