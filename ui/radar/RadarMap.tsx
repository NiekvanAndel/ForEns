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
 *
 * On a page being swiped past it draws a still panel instead. A second MapView
 * allocated on the UI thread at the moment a finger starts moving costs the
 * smoothness of that gesture, and a map travelling across the screen is not read.
 *
 * There is no recentre button. The map already returns to the location whenever the
 * location changes, and the pin is on screen at every zoom the map allows, so the
 * button existed to undo a pan that a reader who had panned did not want undone.
 */
import { useEffect, useRef } from 'react';
import { View, Pressable } from 'react-native';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { radius, shadowFloat, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { MAX_DISPLAY_Z, MIN_ZOOM, START_SPAN_DEG, mapChrome, maxZoomFor } from './mapStyle';
import { activeProvider, type RadarFrame } from '../../core/radar';
import { usePeeking } from '../peek';
import type { AgroStation } from '../../core/sources/agroexact';

/** The span band the zoom buttons work within, matching MIN_ZOOM and maxZoomFor. */
const MIN_SPAN_DEG = 0.05;
const MAX_SPAN_DEG = 24;

/** Everything floating on the map is this tall, so the time badge, the zoom
 *  buttons and the full-screen back button sit on one line. */
export const MAP_CHROME_SIZE = 36;
/** How far the chrome is inset from the map's corners on a card. Full screen passes
 *  its own, because the top of the map there is under the status bar. */
const CHROME_INSET = 14;

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
  /** The pin legend. Off by default: with one pin on the map, a caption naming it
   *  spends a corner of the map explaining a dot that needs no explaining. */
  showLegend?: boolean;
  /** How far down the floating chrome starts. Full screen passes the safe-area
   *  inset, so the time badge clears the clock and the battery rather than sitting
   *  behind them. */
  chromeTop?: number;
  style?: object;
}

export function RadarMap({
  lat, lon, frames, activeIndex, stations, timeLabel,
  interactive = true, showControls = true, showLegend = false,
  chromeTop = CHROME_INSET, style,
}: RadarMapProps) {
  const { palette, appearance } = useTheme();
  const peeking = usePeeking();
  const provider = activeProvider();
  const mapRef = useRef<MapView>(null);
  const region = useRef<Region>({
    latitude: lat, longitude: lon,
    latitudeDelta: START_SPAN_DEG, longitudeDelta: START_SPAN_DEG,
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

  const active = frames[activeIndex] ?? frames[frames.length - 1];

  const zoom = (factor: number) => {
    const r = region.current;
    const next = {
      ...r,
      // Kept inside the same band the map itself is clamped to, so a button press
      // cannot reach a zoom the provider has no tiles for.
      latitudeDelta: Math.min(MAX_SPAN_DEG, Math.max(MIN_SPAN_DEG, r.latitudeDelta * factor)),
      longitudeDelta: Math.min(MAX_SPAN_DEG, Math.max(MIN_SPAN_DEG, r.longitudeDelta * factor)),
    };
    region.current = next;
    mapRef.current?.animateToRegion(next, 200);
  };

  if (peeking) {
    return (
      <View
        style={[
          {
            borderRadius: radius.appCard, overflow: 'hidden',
            backgroundColor: palette.cream2,
            alignItems: 'center', justifyContent: 'center',
          },
          style,
        ]}
      >
        <Icon name="broadcast" size={34} color={palette.inkDisabled} />
      </View>
    );
  }

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
        minZoomLevel={MIN_ZOOM}
        maxZoomLevel={maxZoomFor(provider.maxZoom)}
      >
        {active ? (
          <UrlTile
            key={active.id}
            urlTemplate={provider.tileTemplate({ frame: active })}
            maximumNativeZ={provider.maxZoom}
            maximumZ={MAX_DISPLAY_Z}
            tileSize={provider.tileSize}
            zIndex={1}
            opacity={0.75}
          />
        ) : null}

        {/* A small dot rather than MapKit's teardrop, which at pin size covered a
            county. Drawn as a marker child with tracking left on: freezing the
            snapshot is what previously left the annotation blank or stranded it
            mid-pan, and one marker is cheap enough to re-rasterise. */}
        <Marker
          coordinate={{ latitude: lat, longitude: lon }}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={2}
          title="Jouw locatie"
        >
          <View
            style={{
              width: 16, height: 16, borderRadius: 8,
              backgroundColor: chrome.here,
              borderWidth: 2.5, borderColor: '#fff',
            }}
          />
        </Marker>

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
            position: 'absolute', right: CHROME_INSET, top: chromeTop,
            height: MAP_CHROME_SIZE, justifyContent: 'center',
            backgroundColor: chromeBg,
            borderRadius: radius.pill,
            paddingHorizontal: space[4],
          },
          shadowFloat,
        ]}
      >
        <Text variant="caption" weight="bold" color={chromeInk} tabular>
          {timeLabel}
        </Text>
      </View>

      {showControls ? (
        <View style={{ position: 'absolute', left: CHROME_INSET, top: chromeTop, gap: space[2] }}>
          <ControlButton icon="plus" label="Inzoomen" bg={chromeBg} ink={chromeInk} onPress={() => zoom(0.5)} />
          <ControlButton icon="minus" label="Uitzoomen" bg={chromeBg} ink={chromeInk} onPress={() => zoom(2)} />
        </View>
      ) : null}

      {showLegend ? (
        <View
          style={[
            {
              position: 'absolute', left: CHROME_INSET, bottom: CHROME_INSET,
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
      ) : null}
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
          width: MAP_CHROME_SIZE, height: MAP_CHROME_SIZE, borderRadius: radius.tile,
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
