/**
 * The radar preview card.
 *
 * Shows the live radar imagery at the current location, with the "you are here" pin
 * and any nearby AgroExact station. Tapping opens the full Radar screen.
 *
 * Interaction is deliberately off here: this is a preview that opens a screen, so a
 * pan gesture inside it would fight the page scroll.
 *
 * Square rather than a letterbox, and it follows the app's appearance so the dark
 * theme gets MapKit's dark cartography instead of a bright rectangle in the middle
 * of a navy page.
 *
 * On a page being swiped past it draws a still panel instead of a map. Allocating a
 * second `MapView` on the UI thread at the moment a finger starts moving costs the
 * smoothness of the very gesture the preview is there to serve, and nobody reads a
 * radar image travelling across the screen.
 *
 * The frames are all mounted here too, exactly as on the radar screen — see
 * `RadarLayer`. The card plays the same loop, so it needs the same instant step.
 */
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Camera, Map as MapLibreMap, Marker } from '@maplibre/maplibre-react-native';
import { radius, shadowFloat, space, useTheme } from '../../theme';
import { START_ZOOM, mapChrome, mapStyleFor } from '../radar/mapStyle';
import { RadarLayer } from '../radar/RadarLayer';
import { Card, CardHeader } from '../Card';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';
import { activeProvider, type RadarFrame } from '../../core/radar';
import { usePeeking } from '../peek';

/** How far in the preview opens. The card is a preview of the weather heading
 *  toward you, not of your street: a shower an hour away has to be on screen for the
 *  card to be worth having. Wide enough to hold the country and its coast. */
const PREVIEW_ZOOM = START_ZOOM;

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
 *  played, and then steps through them.
 *
 *  A page being swiped past fetches nothing: it draws a still panel instead of a
 *  map, so the frames would be downloaded for something never shown. Neither does a
 *  location the radar does not reach, which has no frames to show. */
export function useFrames(enabled = true): RadarFrame[] {
  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const peeking = usePeeking();
  useEffect(() => {
    if (peeking || !enabled) return;
    let alive = true;
    activeProvider()
      .listFrames()
      .then((f) => { if (alive) setFrames(f.past); })
      .catch(() => {
        // No frames: the map still renders, just without a radar overlay.
      });
    return () => { alive = false; };
  }, [peeking, enabled]);
  return frames;
}

export function RadarPreview({
  lat, lon, stationName, stationLat, stationLon, onOpen,
}: RadarPreviewProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const peeking = usePeeking();
  const provider = activeProvider();
  // Outside the radar's coverage the card is still a useful map of where you are,
  // but nothing on it may claim to be radar: no frames, no clock, no play button.
  const covered = provider.coversPoint(lat, lon);
  const frames = useFrames(covered);
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
          covered && frames.length > 1 ? (
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
          {peeking ? (
            <View
              style={{
                flex: 1, alignItems: 'center', justifyContent: 'center',
                backgroundColor: palette.cream2,
              }}
            >
              <Icon name="broadcast" size={30} color={palette.inkDisabled} />
            </View>
          ) : (
          <MapLibreMap
            style={{ flex: 1 }}
            mapStyle={mapStyleFor(appearance)}
            dragPan={false}
            touchZoom={false}
            doubleTapZoom={false}
            touchRotate={false}
            touchPitch={false}
            compass={false}
            logo={false}
            attribution
            attributionPosition={{ bottom: space[2], left: space[2] }}
          >
            <Camera initialViewState={{ center: [lon, lat], zoom: PREVIEW_ZOOM }} />
            {covered ? (
              <RadarLayer provider={provider} frames={frames} active={frame ?? undefined} />
            ) : null}
            {/* A small dot, matching the radar page — a default pin at this card's
                scale covered a county. */}
            <Marker lngLat={[lon, lat]} anchor="center">
              <View
                style={{
                  width: 14, height: 14, borderRadius: 7,
                  backgroundColor: chrome.here,
                  borderWidth: 2.5, borderColor: '#fff',
                }}
              />
            </Marker>
            {stationLat != null && stationLon != null ? (
              <Marker lngLat={[stationLon, stationLat]} anchor="center">
                <View
                  accessibilityLabel={stationName}
                  style={{
                    width: 13, height: 13, borderRadius: 7,
                    backgroundColor: palette.agroBright,
                    borderWidth: 2.5, borderColor: '#fff',
                  }}
                />
              </Marker>
            ) : null}
          </MapLibreMap>
          )}

          {covered ? (
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
          ) : null}
        </View>
      </Pressable>
    </Card>
  );
}
