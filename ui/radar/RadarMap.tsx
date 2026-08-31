/**
 * The radar map.
 *
 * Every frame is mounted as its own tile overlay and only the active one is opaque.
 * Swapping a single overlay's URL template instead would make the map flash white
 * on each step, because MapKit discards the old tiles before the new ones arrive;
 * keeping them mounted means playback runs off tiles the map has already cached.
 */
import { useEffect, useRef } from 'react';
import { View, Pressable } from 'react-native';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { radius, shadowFloat, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { PulsePin, StationPin } from './PulsePin';
import { activeProvider, type RadarFrame } from '../../core/radar';
import type { AgroStation } from '../../core/sources/agroexact';

/** Above this, mounting every overlay costs more than the flicker it prevents. */
const MAX_MOUNTED_FRAMES = 16;

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
  const { palette } = useTheme();
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

  const mounted = frames.slice(0, MAX_MOUNTED_FRAMES);

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
      >
        {mounted.map((frame, i) => (
          <UrlTile
            key={frame.id}
            urlTemplate={provider.tileTemplate({ frame })}
            maximumZ={provider.maxZoom}
            zIndex={1}
            // Only the active frame is visible; the rest stay mounted and cached.
            opacity={i === activeIndex ? 0.78 : 0}
          />
        ))}

        <Marker
          coordinate={{ latitude: lat, longitude: lon }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          accessibilityLabel="Jouw locatie"
        >
          <PulsePin />
        </Marker>

        {stations.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lon }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={s.name}
            tracksViewChanges={false}
          >
            <StationPin />
          </Marker>
        ))}
      </MapView>

      <View
        style={[
          {
            position: 'absolute', right: 14, top: 14,
            backgroundColor: 'rgba(255,255,255,.94)',
            borderRadius: radius.pill,
            paddingVertical: 8, paddingHorizontal: space[4],
          },
          shadowFloat,
        ]}
      >
        <Text variant="caption" weight="bold" color="#0C2547" tabular>
          {timeLabel}
        </Text>
      </View>

      {showControls ? (
        <View style={{ position: 'absolute', left: 14, top: 14, gap: space[2] }}>
          <ControlButton icon="plus" label="Inzoomen" onPress={() => zoom(0.5)} />
          <ControlButton icon="minus" label="Uitzoomen" onPress={() => zoom(2)} />
          <ControlButton icon="crosshair" label="Terug naar mijn locatie" onPress={recentre} />
        </View>
      ) : null}

      <View
        style={[
          {
            position: 'absolute', left: 14, bottom: 14,
            backgroundColor: 'rgba(255,255,255,.94)',
            borderRadius: radius.tile,
            paddingVertical: 9, paddingHorizontal: 13,
            gap: 6,
          },
          shadowFloat,
        ]}
      >
        <LegendRow color="#0C2547" ring="#fff" label="Jouw locatie" textColor="#0C2547" />
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
  icon, label, onPress,
}: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        {
          width: 36, height: 36, borderRadius: radius.tile,
          backgroundColor: 'rgba(255,255,255,.94)',
          alignItems: 'center', justifyContent: 'center',
        },
        shadowFloat,
      ]}
    >
      <Icon name={icon} size={17} color="#0C2547" weight="bold" />
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
