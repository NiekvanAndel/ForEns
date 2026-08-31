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
 */
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import { radius, shadowFloat, space, useTheme } from '../../theme';
import { MAX_DISPLAY_Z, mapChrome } from '../radar/mapStyle';
import { Card, CardHeader } from '../Card';
import { Text } from '../Text';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';
import { activeProvider, type RadarFrame } from '../../core/radar';

export interface RadarPreviewProps {
  lat: number;
  lon: number;
  stationName?: string;
  stationLat?: number;
  stationLon?: number;
  onOpen: () => void;
}

/** Latest observed frame, which is what "nu" means on the preview. */
export function useLatestFrame(): RadarFrame | null {
  const [frame, setFrame] = useState<RadarFrame | null>(null);
  useEffect(() => {
    let alive = true;
    activeProvider()
      .listFrames()
      .then((f) => {
        if (!alive) return;
        setFrame(f.past[f.past.length - 1] ?? null);
      })
      .catch(() => {
        // No frames: the map still renders, just without a radar overlay.
      });
    return () => {
      alive = false;
    };
  }, []);
  return frame;
}

export function RadarPreview({
  lat, lon, stationName, stationLat, stationLon, onOpen,
}: RadarPreviewProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const frame = useLatestFrame();
  const provider = activeProvider();
  const chrome = mapChrome(palette, appearance);

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
      />
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open radar">
        <View style={{ aspectRatio: 1, borderRadius: 18, overflow: 'hidden' }}>
          <MapView
            provider={PROVIDER_DEFAULT}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: lat, longitude: lon,
              latitudeDelta: 1.6, longitudeDelta: 1.6,
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
                urlTemplate={provider.tileTemplate({ frame })}
                maximumNativeZ={provider.maxZoom}
                maximumZ={MAX_DISPLAY_Z}
                zIndex={1}
                opacity={0.75}
              />
            ) : null}
            {/* MapKit's own annotations, not React children — see ui/radar/mapStyle. */}
            <Marker
              coordinate={{ latitude: lat, longitude: lon }}
              pinColor={chrome.here}
              zIndex={2}
            />
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
              nu · {time}
            </Text>
          </View>
        </View>
      </Pressable>
    </Card>
  );
}
