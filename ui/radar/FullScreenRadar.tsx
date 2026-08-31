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
 */
import { useState } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, shadowFloat, space, useTheme } from '../../theme';
import { Icon } from '../Icon';
import { RadarMap } from './RadarMap';
import { Timeline } from './Timeline';
import { NowcastPanel } from './NowcastPanel';
import { mapChrome } from './mapStyle';
import { frameLabel, type NowcastProfile, type RadarFrame } from '../../core/radar';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';
import type { AgroStation } from '../../core/sources/agroexact';

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
}

export function FullScreenRadar({
  visible, onClose, lat, lon, frames, activeIndex, onScrub,
  playing, onTogglePlay, stations, profile,
}: FullScreenRadarProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const chrome = mapChrome(palette, appearance);
  const [panelWidth, setPanelWidth] = useState(width);

  const active = frames[activeIndex];
  // Minutes from now for the frame on screen, which is what the panel's cursor and
  // its headline intensity are pinned to.
  const offsetMin = active ? Math.round((active.timeMs - Date.now()) / 60_000) : 0;

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
            timeLabel={frameLabel(active)}
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
          <NowcastPanel
            profile={profile}
            offsetMin={offsetMin}
            width={Math.max(1, panelWidth - space[5] * 2)}
          />
          <View style={{ paddingHorizontal: space[5] }}>
            <Timeline
              frames={frames}
              index={activeIndex}
              playing={playing}
              onIndexChange={onScrub}
              onTogglePlay={onTogglePlay}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
