/**
 * The radar preview card.
 *
 * Shows the real RainViewer tiles at the current location, with the "you are here"
 * pin and any nearby AgroExact station. Tapping opens the full Radar screen.
 *
 * Interaction is deliberately off here: this is a preview that opens a screen, so a
 * pan gesture inside it would fight the page scroll.
 *
 * Square rather than a letterbox, and it follows the app's appearance so the dark
 * theme gets MapKit's dark cartography instead of a bright rectangle in the middle
 * of a navy page.
 *
 * It does NOT set `maximumNativeZ`. That prop switches react-native-maps onto its
 * cached-overlay path, which refetches and rescales tiles itself — worth it on the
 * radar screen, where a reader can zoom past the provider's deepest level, and not
 * worth it here, where the region is fixed and cannot over-zoom. Setting it anyway
 * is what put "Zoom Level Not Supported" tiles across this card.
 */
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import { radius, shadowFloat, space, useTheme } from '../../theme';
import { START_SPAN_DEG, mapChrome } from '../radar/mapStyle';
import { Card, CardHeader } from '../Card';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';
import { activeProvider, type RadarFrame } from '../../core/radar';

/** How much of the map the preview shows, in degrees. The card became square, which
 *  a preview of the weather heading toward you, not of your street: a shower an hour
 *  away has to be on screen for the card to be worth having. Wide enough to hold the
 *  country and its coast. */
const PREVIEW_SPAN_DEG = START_SPAN_DEG;

/** How long each frame is held while the loop plays. Slow enough to read a shower's
 *  direction, fast enough that the whole hour passes in a few seconds. */
const FRAME_MS = 420;

export interface RadarPreviewProps {
  lat: number;
  lon: number;
  stationName?: string;
  stationLat?: number;
  stationLon?: number;
  onOpen: () => void;
}

/** The observed frames, newest last. The preview shows the newest until it is
 *  played, and then steps through them. */
export function useFrames(): RadarFrame[] {
  const [frames, setFrames] = useState<RadarFrame[]>([]);
  useEffect(() => {
    let alive = true;
    activeProvider()
      .listFrames()
      .then((f) => { if (alive) setFrames(f.past); })
      .catch(() => {
        // No frames: the map still renders, just without a radar overlay.
      });
    return () => { alive = false; };
  }, []);
  return frames;
}

export function RadarPreview({
  lat, lon, stationName, stationLat, stationLon, onOpen,
}: RadarPreviewProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const frames = useFrames();
  const provider = activeProvider();
  const chrome = mapChrome(palette, appearance);

  // Playing the loop here answers "which way is it moving?" without leaving the
  // page. It stops itself at the newest frame rather than looping forever, so a
  // card left on screen is not animating in the corner of the reader's eye.
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(Math.max(0, frames.length - 1));
  }, [frames.length]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => {
        if (i >= frames.length - 1) {
          setPlaying(false);
          return frames.length - 1;
        }
        return i + 1;
      });
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [playing, frames.length]);

  // One button, two jobs. Pausing holds the frame on screen rather than snapping
  // back to the newest one: the reader pressed pause to look at *this* picture.
  // Pressing play again resumes from there, unless the loop already ran to the end,
  // in which case there is nothing ahead and it starts over.
  const togglePlaying = () => {
    if (frames.length < 2) return;
    if (playing) {
      setPlaying(false);
      return;
    }
    if (index >= frames.length - 1) setIndex(0);
    setPlaying(true);
  };

  const frame = frames[index] ?? null;

  const time = frame
    ? new Date(frame.timeMs).toLocaleTimeString(prefs.lang, { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <Card>
      <CardHeader
        icon="broadcast"
        label={ta('tabRadar', prefs.lang)}
        action={ta('full', prefs.lang)}
        onAction={onOpen}
        adornment={
          frames.length > 1 ? (
            <Pressable
              onPress={togglePlaying}
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Radarbeelden pauzeren' : 'Radarbeelden afspelen'}
              hitSlop={8}
              style={{ marginLeft: 2 }}
            >
              <Icon
                name={playing ? 'pause' : 'play'}
                size={14}
                color={playing ? palette.accentDark : palette.muted}
                weight="fill"
              />
            </Pressable>
          ) : null
        }
      />
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open radar">
        <View style={{ aspectRatio: 1, borderRadius: 18, overflow: 'hidden' }}>
          <MapView
            provider={PROVIDER_DEFAULT}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: lat, longitude: lon,
              latitudeDelta: PREVIEW_SPAN_DEG, longitudeDelta: PREVIEW_SPAN_DEG,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            userInterfaceStyle={appearance}
          >
            {frame ? (
              <UrlTile
                key={frame.id}
                urlTemplate={provider.tileTemplate({ frame })}
                maximumZ={provider.maxZoom}
                zIndex={1}
                opacity={0.75}
              />
            ) : null}
            {/* A small dot, matching the radar page — MapKit's teardrop at pin size
                covered a county on a card this scale. */}
            <Marker
              coordinate={{ latitude: lat, longitude: lon }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={2}
            >
              <View
                style={{
                  width: 14, height: 14, borderRadius: 7,
                  backgroundColor: chrome.here,
                  borderWidth: 2.5, borderColor: '#fff',
                }}
              />
            </Marker>
            {stationLat != null && stationLon != null ? (
              <Marker
                coordinate={{ latitude: stationLat, longitude: stationLon }}
                title={stationName}
                pinColor={palette.agroBright}
                zIndex={2}
              />
            ) : null}
          </MapView>

          <View
            style={[
              {
                position: 'absolute', right: 12, top: 12,
                backgroundColor: chrome.bg,
                borderRadius: radius.pill,
                paddingVertical: 6, paddingHorizontal: space[3],
              },
              shadowFloat,
            ]}
          >
            <Text variant="caption" weight="bold" color={chrome.ink} tabular>
              {playing ? time : `nu · ${time}`}
            </Text>
          </View>
        </View>
      </Pressable>
    </Card>
  );
}
