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
 * Two zoom limits, not one. `maximumNativeZ` is the deepest level the provider
 * actually has tiles for; `maximumZ` is the deepest level the overlay is drawn at.
 * Setting only `maximumZ` to the provider's limit makes MapKit stop drawing past it
 * and show "Zoom Level Not Supported" instead of upscaling, which is what the radar
 * was doing. Past the native limit the tiles are stretched — blurrier, but radar
 * pixels are 1 km wide anyway, so there is no detail being withheld.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { radius, shadowFloat, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { PulsePin, StationPin } from './PulsePin';
import { activeProvider, type RadarFrame } from '../../core/radar';
import type { AgroStation } from '../../core/sources/agroexact';

/** How far the overlay is drawn. Beyond `provider.maxZoom` MapKit upscales the
 *  provider's deepest tiles rather than dropping the layer. */
const MAX_DISPLAY_Z = 19;

/** How long the pin keeps re-snapshotting after mount. A marker rendered from a
 *  React child is captured once when `tracksViewChanges` goes false; capture it
 *  too early — before the child has laid out — and the annotation stays empty,
 *  which is why the location dot vanished. Two seconds covers layout and one turn
 *  of the pulse, then tracking stops so panning is not re-rasterising every pin. */
const PIN_SETTLE_MS = 2000;

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

  // Re-snapshot the pins briefly after mount, then freeze them.
  const [pinTracking, setPinTracking] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setPinTracking(false), PIN_SETTLE_MS);
    return () => clearTimeout(id);
  }, []);

  // Chrome floats on the map, so it takes its colours from the map's appearance
  // rather than from the page beneath it.
  const dark = appearance === 'dark';
  const chromeBg = dark ? 'rgba(20,32,52,.90)' : 'rgba(255,255,255,.94)';
  const chromeInk = dark ? '#F2F7FC' : '#0C2547';

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
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={pinTracking}
          zIndex={2}
          accessibilityLabel="Jouw locatie"
        >
          <PulsePin animated={pinTracking} />
        </Marker>

        {stations.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lon }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={s.name}
            tracksViewChanges={pinTracking}
            zIndex={2}
          >
            <StationPin />
          </Marker>
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
        <LegendRow
          color={dark ? palette.skySoft : '#0C2547'}
          ring="#fff"
          label="Jouw locatie"
          textColor={chromeInk}
        />
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
