/**
 * The radar map.
 *
 * Only the active frame is mounted, keyed so it remounts when the frame changes.
 *
 * An earlier version mounted every frame and drove visibility with `opacity`, to
 * avoid a flash between steps. On iOS that renders nothing at all: react-native-maps
 * does not honour per-overlay opacity on `UrlTile`, so all sixteen overlays stacked
 * and the map stayed blank. The radar preview on the Nowcast screen, which has
 * always mounted a single overlay, is what showed the difference. Correctness beats
 * the optimisation — MapKit's own tile cache makes replay smooth after one pass.
 *
 * Zoom limits and pin rendering are explained in ./mapStyle, which the preview on
 * 'Nu' shares.
 */
import { useEffect, useRef } from 'react';
import { View, Pressable } from 'react-native';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { radius, shadowFloat, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { MAX_DISPLAY_Z, mapChrome, maxZoomFor } from './mapStyle';
import { activeProvider, type RadarFrame } from '../../core/radar';
import type { AgroStation } from '../../core/sources/agroexact';

export interface RadarMapProps {
  lat: number;
  lon: number;
  frames: RadarFrame[];
  activeIndex: number;
  stations: AgroStation[];
  /** Label for the time badge, e.g. "nu" or "+45 min". */
  timeLabel: string;
  interactive?: boolean;
  showControls?: boolean;
  style?: object;
}

export function RadarMap({
  lat, lon, frames, activeIndex, stations, timeLabel,
  interactive = true, showControls = true, style,
}: RadarMapProps) {
  const { palette, appearance } = useTheme();
  const provider = activeProvider();
  const mapRef = useRef<MapView>(null);
  const region = useRef<Region>({
    latitude: lat, longitude: lon,
    latitudeDelta: 2.2, longitudeDelta: 2.2,
  });

  // Recentre when the chosen location changes, rather than stranding the user
  // looking at the previous city.
  useEffect(() => {
    region.current = { ...region.current, latitude: lat, longitude: lon };
    mapRef.current?.animateToRegion(region.current, 400);
  }, [lat, lon]);

  const chrome = mapChrome(palette, appearance);
  const chromeBg = chrome.bg;
  const chromeInk = chrome.ink;
  const dark = chrome.dark;

  const active = frames[activeIndex] ?? frames[frames.length - 1];

  const zoom = (factor: number) => {
    const r = region.current;
    const next = {
      ...r,
      latitudeDelta: Math.min(80, Math.max(0.02, r.latitudeDelta * factor)),
      longitudeDelta: Math.min(80, Math.max(0.02, r.longitudeDelta * factor)),
    };
    region.current = next;
    mapRef.current?.animateToRegion(next, 200);
  };

  const recentre = () => {
    const next = { ...region.current, latitude: lat, longitude: lon };
    region.current = next;
    mapRef.current?.animateToRegion(next, 300);
  };

  return (
    <View style={[{ borderRadius: radius.appCard, overflow: 'hidden' }, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={region.current}
        onRegionChangeComplete={(r) => { region.current = r; }}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsCompass={false}
        userInterfaceStyle={appearance}
        maxZoomLevel={maxZoomFor(provider.maxZoom)}
      >
        {active ? (
          <UrlTile
            key={active.id}
            urlTemplate={provider.tileTemplate({ frame: active })}
            maximumNativeZ={provider.maxZoom}
            maximumZ={MAX_DISPLAY_Z}
            zIndex={1}
            opacity={0.75}
          />
        ) : null}

        <Marker
          coordinate={{ latitude: lat, longitude: lon }}
          pinColor={chrome.here}
          zIndex={2}
          title="Jouw locatie"
        />

        {stations.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lon }}
            title={s.name}
            pinColor={palette.agroBright}
            zIndex={2}
          />
        ))}
      </MapView>

      <View
        style={[
          {
            position: 'absolute', right: 14, top: 14,
            backgroundColor: chromeBg,
            borderRadius: radius.pill,
            paddingVertical: 8, paddingHorizontal: space[4],
          },
          shadowFloat,
        ]}
      >
        <Text variant="caption" weight="bold" color={chromeInk} tabular>
          {timeLabel}
        </Text>
      </View>

      {showControls ? (
        <View style={{ position: 'absolute', left: 14, top: 14, gap: space[2] }}>
          <ControlButton icon="plus" label="Inzoomen" bg={chromeBg} ink={chromeInk} onPress={() => zoom(0.5)} />
          <ControlButton icon="minus" label="Uitzoomen" bg={chromeBg} ink={chromeInk} onPress={() => zoom(2)} />
          <ControlButton icon="crosshair" label="Terug naar mijn locatie" bg={chromeBg} ink={chromeInk} onPress={recentre} />
        </View>
      ) : null}

      <View
        style={[
          {
            position: 'absolute', left: 14, bottom: 14,
            backgroundColor: chromeBg,
            borderRadius: radius.tile,
            paddingVertical: 9, paddingHorizontal: 13,
            gap: 6,
          },
          shadowFloat,
        ]}
      >
        <LegendRow color={chrome.here} ring="#fff" label="Jouw locatie" textColor={chromeInk} />
        {stations.length ? (
          <LegendRow
            color="#fff"
            ring={palette.agroBright}
            label="AgroExact-station"
            textColor={palette.agroInk}
          />
        ) : null}
      </View>
    </View>
  );
}

function ControlButton({
  icon, label, onPress, bg, ink,
}: { icon: string; label: string; onPress: () => void; bg: string; ink: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        {
          width: 36, height: 36, borderRadius: radius.tile,
          backgroundColor: bg,
          alignItems: 'center', justifyContent: 'center',
        },
        shadowFloat,
      ]}
    >
      <Icon name={icon} size={17} color={ink} weight="bold" />
    </Pressable>
  );
}

function LegendRow({
  color, ring, label, textColor,
}: { color: string; ring: string; label: string; textColor: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: color, borderWidth: 2, borderColor: ring,
        }}
      />
      <Text variant="caption" weight="semibold" color={textColor}>
        {label}
      </Text>
    </View>
  );
}
