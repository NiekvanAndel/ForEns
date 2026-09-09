/**
 * The map, full screen, with the nowcast profile beneath it.
 *
 * The radar card answers "where is it raining"; this answers "and how hard, here,
 * over the next two hours" — the map fills the screen so a shower's track is
 * readable, and the panel below turns the picture into the two numbers a reader
 * acts on.
 *
 * ## It is a page now, not a modal
 *
 * This used to be a modal the radar tab presented, and the map button in the top row
 * reached it by routing to that tab with a parameter that told it to open the modal.
 * Which made the map a thing the radar page owned, reachable from the top row by
 * going through a page the reader had not asked for — and left the button's
 * behaviour depending on which tab happened to be in front.
 *
 * So the relationship is the other way round: the map is `app/map.tsx`, the top row's
 * button pushes it, and the radar page's full-screen button pushes the same route.
 * Both arrive at the location that is already selected, because the selection is
 * shared state — the station the radar page was drawing is the station the map
 * opens on, with nothing passed between them to get out of step.
 *
 * The body lives here rather than in the route file so the route stays what every
 * other route in this app is: a page component and the frame around it.
 *
 * Every other saved location is a pin here, where there is room for them: tapping
 * one selects it, and the map, the profile and the pins all follow without leaving
 * the page. That is the only way to change location from here — the sideways swipe
 * that does it elsewhere belongs to the pages under the tab bar, and a map you can
 * pan is no place for a gesture that navigates.
 *
 * ## The panel has two states, and each is one control
 *
 * Open, it is the curve with its header: the place, how hard it is raining at the
 * frame on screen, and a small play button beside the name. The curve is the
 * scrubber — dragging its handle moves the loop.
 *
 * Swiped down, all of that folds away and what is left is a single row: a full-sized
 * play button and the slider beside it. Sometimes the map is the whole point and the
 * panel should be a band across the bottom of it, and this is the smallest thing
 * that still drives the loop.
 *
 * The two trade places on one gesture — the row unfolds by exactly what the curve
 * gives up — so the panel keeps its height and the loop is scrubbable at both ends of
 * the drag. Nothing is shown twice: the header's play button and the row's are never
 * on screen together.
 *
 * Where there is no curve at all — a location the nowcast does not reach — there is
 * nothing to fold, so the grabber goes and the row simply stands. The rule under
 * every case is the same one: something on screen has to be draggable.
 */
import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { duration, radius, shadowFloat, space, useTheme } from '../../theme';
import { Icon } from '../Icon';
import { RadarMap, MAP_CHROME_SIZE, type PlacePin } from './RadarMap';
import { Timeline } from './Timeline';
import { hasNowcastCurve, NowcastPanel } from './NowcastPanel';
import { mapChrome } from './mapStyle';
import { frameAtFraction } from './useRadarFrames';
import {
  forecastBoundary, frameClock, radarAxis, type NowcastProfile, type RadarFrame,
} from '../../core/radar';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';

/** The header, the curve and its axis. Animating a fixed maximum is what lets the
 *  fold be a height rather than a measurement; set too high, the first part of it
 *  does nothing visible. */
const PROFILE_MAX_HEIGHT = 190;
/** The play button, the slider and the air above them — what unfolds as the curve
 *  folds. The 42pt button is the tallest thing in the row; set this higher and the
 *  last part of the fold animates a height nothing occupies. */
const TIMELINE_HEIGHT = 50;

export interface FullMapProps {
  /** Leaves the page. The route hands in `router.back()`. */
  onClose: () => void;
  lat: number;
  lon: number;
  frames: RadarFrame[];
  activeIndex: number;
  onScrub: (index: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  /** The reader's other saved locations, as pins that switch to them. */
  places: PlacePin[];
  onSelectPlace: (index: number) => void;
  profile: NowcastProfile | null;
  /** Named in the profile's header, as on the radar page. */
  locationName?: string;
}

export function FullMap({
  onClose, lat, lon, frames, activeIndex, onScrub,
  playing, onTogglePlay, places, onSelectPlace, profile, locationName,
}: FullMapProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const chrome = mapChrome(palette, appearance);
  const [panelWidth, setPanelWidth] = useState(width);
  // The profile collapses out of the way; the timeline below it never does.
  const [profileOpen, setProfileOpen] = useState(true);
  const reduceMotion = useReducedMotion();
  const collapse = useSharedValue(0);
  // Nothing to fold away, and nothing to drag: the slider stands rather than
  // trading places with a curve that was never drawn.
  const curve = hasNowcastCurve(profile);

  const setOpen = (open: boolean) => {
    setProfileOpen(open);
    collapse.value = reduceMotion
      ? (open ? 0 : 1)
      : withTiming(open ? 0 : 1, { duration: duration.base });
  };

  // A downward drag on the profile puts it away; an upward one brings it back.
  const drag = Gesture.Pan()
    .activeOffsetY([-14, 14])
    .onEnd((e) => {
      if (e.translationY > 30 || e.velocityY > 500) runOnJS(setOpen)(false);
      else if (e.translationY < -30 || e.velocityY < -500) runOnJS(setOpen)(true);
    });

  const profileStyle = useAnimatedStyle(() => ({
    opacity: 1 - collapse.value,
    // Collapsing height rather than translating keeps everything below it in place.
    maxHeight: (1 - collapse.value) * PROFILE_MAX_HEIGHT,
  }));

  // The exact inverse: what the curve gives up, the slider takes.
  const timelineStyle = useAnimatedStyle(() => ({
    opacity: collapse.value,
    maxHeight: collapse.value * TIMELINE_HEIGHT,
  }));

  const active = frames[activeIndex];
  // Minutes from now for the frame on screen, which is what the panel's cursor and
  // its headline intensity are pinned to.
  const offsetMin = active ? Math.round((active.timeMs - Date.now()) / 60_000) : 0;
  // One axis for the chart and the scrubber, exactly as on the radar page.
  const axis = radarAxis(frames);

  const scrubTo = (fraction: number) => {
    const at = frameAtFraction(axis?.positions, fraction);
    if (at != null) onScrub(at);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.appBg }}>
      <View style={{ flex: 1 }}>
        <RadarMap
          lat={lat}
          lon={lon}
          frames={frames}
          activeIndex={activeIndex}
          places={places}
          onSelectPlace={onSelectPlace}
          timeLabel={frameClock(active)}
          showControls={false}
          // The map runs under the status bar here, so its chrome starts below
          // the safe area: the time badge used to sit behind the battery.
          chromeTop={insets.top + space[2]}
          // The panel below is pulled up over the map by one card radius, so the
          // attribution has to clear that much or it is hidden behind it.
          attributionPosition={{ bottom: radius.appCard + space[2], left: space[3] }}
          style={{ flex: 1, borderRadius: 0 }}
        />

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={ta('done', prefs.lang)}
          hitSlop={10}
          style={[
            {
              // Same line as the time badge on the right, and the same height,
              // so the two read as one row of chrome across the top.
              position: 'absolute', left: 14, top: insets.top + space[2],
              width: MAP_CHROME_SIZE, height: MAP_CHROME_SIZE, borderRadius: radius.pill,
              backgroundColor: chrome.bg,
              alignItems: 'center', justifyContent: 'center',
            },
            shadowFloat,
          ]}
        >
          <Icon name="caret-left" size={18} color={chrome.ink} weight="bold" />
        </Pressable>
      </View>

      <View
        onLayout={(e) => setPanelWidth(e.nativeEvent.layout.width)}
        style={{
          backgroundColor: palette.appCard,
          borderTopLeftRadius: radius.appCard,
          borderTopRightRadius: radius.appCard,
          paddingBottom: insets.bottom + space[3],
          marginTop: -radius.appCard,
        }}
      >
        <GestureDetector gesture={drag}>
          <View>
            {/* The grabber says the panel moves, and taps as a shortcut for the
                reader who would rather not drag. Without a curve there is nothing
                to fold, so it is not drawn. */}
            {curve ? (
              <Pressable
                onPress={() => setOpen(!profileOpen)}
                accessibilityRole="button"
                accessibilityLabel={profileOpen ? 'Neerslaggrafiek verbergen' : 'Neerslaggrafiek tonen'}
                accessibilityState={{ expanded: profileOpen }}
                hitSlop={10}
                style={{ alignItems: 'center', paddingTop: space[3], paddingBottom: space[2] }}
              >
                <View
                  style={{
                    width: 38, height: 4, borderRadius: 2,
                    backgroundColor: palette.hairline,
                  }}
                />
              </Pressable>
            ) : null}

            <Animated.View style={[{ overflow: 'hidden' }, profileStyle]}>
              <NowcastPanel
                profile={profile}
                offsetMin={offsetMin}
                width={Math.max(1, panelWidth - space[5] * 2)}
                domain={axis ? { from: axis.from, to: axis.to } : undefined}
                locationName={locationName}
                onScrubFraction={scrubTo}
                boundaryFraction={forecastBoundary(frames, axis?.positions)}
                playing={playing}
                onTogglePlay={onTogglePlay}
                playDisabled={frames.length < 2}
              />
            </Animated.View>
          </View>
        </GestureDetector>

        {curve ? (
          <Animated.View
            // Invisible is also untouchable: a slider at zero opacity behind the
            // curve would still swallow the drag meant for the curve.
            pointerEvents={profileOpen ? 'none' : 'auto'}
            style={[
              { overflow: 'hidden', paddingHorizontal: space[5], paddingTop: space[2] },
              timelineStyle,
            ]}
          >
            <Timeline
              frames={frames}
              index={activeIndex}
              onIndexChange={onScrub}
              playing={playing}
              onTogglePlay={onTogglePlay}
              showLabels={false}
              stepPositions={axis?.positions}
            />
          </Animated.View>
        ) : (
          <View style={{ paddingHorizontal: space[5], paddingTop: space[2] }}>
            <Timeline
              frames={frames}
              index={activeIndex}
              onIndexChange={onScrub}
              playing={playing}
              onTogglePlay={onTogglePlay}
              showLabels={false}
              stepPositions={axis?.positions}
            />
          </View>
        )}
      </View>
    </View>
  );
}
