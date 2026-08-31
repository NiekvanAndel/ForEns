/**
 * The radar preview card.
 *
 * Shows the real RainViewer tiles at the current location, with the "you are here"
 * pin and any nearby AgroExact station. Tapping opens the full Radar screen.
 *
 * Interaction is deliberately off here: this is a preview that opens a screen, so a
 * pan gesture inside it would fight the page scroll.
 */
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import { radius, shadowFloat, space, useTheme } from '../../theme';
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
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const frame = useLatestFrame();
  const provider = activeProvider();

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
        <View style={{ height: 168, borderRadius: 18, overflow: 'hidden' }}>
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
          >
            {frame ? (
              <UrlTile
                urlTemplate={provider.tileTemplate({ frame })}
                maximumZ={provider.maxZoom}
                zIndex={1}
                opacity={0.75}
              />
            ) : null}
            <Marker coordinate={{ latitude: lat, longitude: lon }} tracksViewChanges={false}>
              <View
                style={[
                  {
                    width: 21, height: 21, borderRadius: 11,
                    backgroundColor: palette.inkHeading,
                    borderWidth: 3, borderColor: '#fff',
                  },
                  shadowFloat,
                ]}
              />
            </Marker>
            {stationLat != null && stationLon != null ? (
              <Marker
                coordinate={{ latitude: stationLat, longitude: stationLon }}
                title={stationName}
                tracksViewChanges={false}
              >
                <View
                  style={[
                    {
                      width: 14, height: 14, borderRadius: 7,
                      backgroundColor: '#fff',
                      borderWidth: 3, borderColor: palette.agroBright,
                    },
                    shadowFloat,
                  ]}
                />
              </Marker>
            ) : null}
          </MapView>

          <View
            style={[
              {
                position: 'absolute', right: 12, top: 12,
                backgroundColor: 'rgba(255,255,255,.94)',
                borderRadius: radius.pill,
                paddingVertical: 6, paddingHorizontal: space[3],
              },
              shadowFloat,
            ]}
          >
            <Text variant="caption" weight="bold" color="#0C2547" tabular>
              nu · {time}
            </Text>
          </View>
        </View>
      </Pressable>
    </Card>
  );
}
