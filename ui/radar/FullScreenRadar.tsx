/**
 * The radar, full screen, with the nowcast profile beneath it.
 *
 * The radar card answers "where is it raining"; this answers "and how hard, here,
 * over the next two hours" — the map fills the screen so a shower's track is
 * readable, and the panel below turns the picture into the two numbers a reader
 * acts on.
 *
 * Presented as a full-screen modal rather than a route so it dismisses back to the
 * same scroll position, and so the tab bar is genuinely out of the way.
 *
 * The profile can be swiped down out of the way, because sometimes the map is the
 * whole point and the panel is a band across the bottom of it. The timeline and its
 * play button never go: they are how the loop is driven, and a control that
 * disappears when you push the thing above it is a control you cannot find again.
 */
import { useState } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { duration, radius, shadowFloat, space, useTheme } from '../../theme';
import { Icon } from '../Icon';
import { RadarMap } from './RadarMap';
import { Timeline } from './Timeline';
import { NowcastPanel } from './NowcastPanel';
import { mapChrome } from './mapStyle';
import { frameClock, type NowcastProfile, type RadarFrame } from '../../core/radar';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';
import type { AgroStation } from '../../core/sources/agroexact';

/** Enough for the headings, the curve and its axis. Animating a fixed maximum is
 *  what lets the timeline stay put while the profile above it folds away. */
const PROFILE_MAX_HEIGHT = 190;

export interface FullScreenRadarProps {
  visible: boolean;
  onClose: () => void;
  lat: number;
  lon: number;
  frames: RadarFrame[];
  activeIndex: number;
  onScrub: (index: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  stations: AgroStation[];
  profile: NowcastProfile | null;
  /** Named in the profile's header, as on the radar page. */
  locationName?: string;
}

export function FullScreenRadar({
  visible, onClose, lat, lon, frames, activeIndex, onScrub,
  playing, onTogglePlay, stations, profile, locationName,
}: FullScreenRadarProps) {
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
    // Collapsing height rather than translating keeps the timeline where it is.
    maxHeight: (1 - collapse.value) * PROFILE_MAX_HEIGHT,
  }));

  const active = frames[activeIndex];
  // Minutes from now for the frame on screen, which is what the panel's cursor and
  // its headline intensity are pinned to.
  const offsetMin = active ? Math.round((active.timeMs - Date.now()) / 60_000) : 0;
  // The axis spans the whole loop, so the cursor tracks the scrubber across it
  // rather than parking against the left edge where the forecast begins.
  const domain = frames.length
    ? {
        from: Math.round((frames[0]!.timeMs - Date.now()) / 60_000),
        to: Math.round((frames[frames.length - 1]!.timeMs - Date.now()) / 60_000),
      }
    : undefined;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: palette.appBg }}>
        <View style={{ flex: 1 }}>
          <RadarMap
            lat={lat}
            lon={lon}
            frames={frames}
            activeIndex={activeIndex}
            stations={stations}
            timeLabel={frameClock(active)}
            showControls={false}
            style={{ flex: 1, borderRadius: 0 }}
          />

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={ta('done', prefs.lang)}
            hitSlop={10}
            style={[
              {
                position: 'absolute', left: space[5], top: insets.top + space[3],
                width: 42, height: 42, borderRadius: radius.pill,
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
                  reader who would rather not drag. */}
              <Pressable
                onPress={() => setOpen(!profileOpen)}
                accessibilityRole="button"
                accessibilityLabel={profileOpen ? 'Grafiek verbergen' : 'Grafiek tonen'}
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

              <Animated.View style={[{ overflow: 'hidden' }, profileStyle]}>
                <NowcastPanel
                  profile={profile}
                  offsetMin={offsetMin}
                  width={Math.max(1, panelWidth - space[5] * 2)}
                  domain={domain}
                  locationName={locationName}
                />
              </Animated.View>
            </View>
          </GestureDetector>

          <View style={{ paddingHorizontal: space[5], paddingTop: space[2] }}>
            <Timeline
              frames={frames}
              index={activeIndex}
              playing={playing}
              onIndexChange={onScrub}
              onTogglePlay={onTogglePlay}
              showLabels={false}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
