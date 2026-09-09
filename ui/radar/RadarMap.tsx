/**
 * The radar map.
 *
 * The imagery itself is drawn by `RadarLayer`, which is shared with the preview card
 * and holds the rule that makes the loop animate: every frame mounted, a step only
 * flips opacity. Why the map is MapLibre rather than Apple Maps, and why the camera
 * is clamped, are both in ./mapStyle.
 *
 * On a page being swiped past it draws a still panel instead. A second map allocated
 * on the UI thread at the moment a finger starts moving costs the smoothness of that
 * gesture, and a map travelling across the screen is not read.
 *
 * There is no recentre button. The map already returns to the location whenever the
 * location changes, and the pin is on screen at every zoom the map allows, so the
 * button existed to undo a pan that a reader who had panned did not want undone.
 */
import { useEffect, useRef } from 'react';
import { View, Pressable } from 'react-native';
import {
  Camera, Map as MapLibreMap, Marker, type CameraRef, type MapProps,
} from '@maplibre/maplibre-react-native';
import { radius, shadowFloat, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { MIN_ZOOM, START_ZOOM, ZOOM_STEP, mapChrome, mapStyleFor, maxZoomFor } from './mapStyle';
import { RadarLayer } from './RadarLayer';
import { activeProvider, type RadarFrame } from '../../core/radar';
import { usePeeking } from '../peek';
import type { SavedLocation } from '../../core/prefs';

/** One of the reader's other saved locations, as the map draws it. */
export interface PlacePin {
  location: SavedLocation;
  /** Its slot in the saved list, which is what selecting it needs. */
  index: number;
}

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
  /** The reader's other saved locations, drawn as pins that select them. Left out
   *  on the card, where the map answers "is it raining here" and every other dot is
   *  a distraction from the one that matters. */
  places?: PlacePin[];
  /** Selects a place. Without it the pins are labels rather than controls. */
  onSelectPlace?: (index: number) => void;
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
  /** Where the basemap's attribution button sits. It is the map's own ornament, so
   *  it can only be placed inside the map — which means the caller has to say where
   *  it will not be covered. Full screen passes a raised position, because the
   *  profile panel is pulled up over the bottom of the map there and swallowed it. */
  attributionPosition?: MapProps['attributionPosition'];
  style?: object;
}

export function RadarMap({
  lat, lon, frames, activeIndex, places = [], onSelectPlace, timeLabel,
  interactive = true, showControls = true, showLegend = false,
  chromeTop = CHROME_INSET, attributionPosition = { bottom: space[2], left: space[2] },
  style,
}: RadarMapProps) {
  const { palette, appearance } = useTheme();
  const peeking = usePeeking();
  const provider = activeProvider();
  const camera = useRef<CameraRef>(null);
  const maxZoom = maxZoomFor(provider.maxZoom);
  // Tracked so a zoom button knows where it is starting from; the camera itself
  // owns the live value once the reader pans.
  const zoom = useRef(START_ZOOM);

  // Recentre when the chosen location changes, rather than stranding the user
  // looking at the previous city.
  useEffect(() => {
    camera.current?.flyTo({ center: [lon, lat], duration: 400 });
  }, [lat, lon]);

  const chrome = mapChrome(palette, appearance);
  const chromeBg = chrome.bg;
  const chromeInk = chrome.ink;

  const active = frames[activeIndex] ?? frames[frames.length - 1];

  const stepZoom = (by: number) => {
    const next = Math.min(maxZoom, Math.max(MIN_ZOOM, zoom.current + by));
    zoom.current = next;
    camera.current?.zoomTo(next, { duration: 200 });
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
      <MapLibreMap
        style={{ flex: 1 }}
        mapStyle={mapStyleFor(appearance)}
        dragPan={interactive}
        touchZoom={interactive}
        doubleTapZoom={interactive}
        touchRotate={false}
        touchPitch={false}
        compass={false}
        logo={false}
        // OpenStreetMap's licence wants crediting, and the style carries the line;
        // the button is the least intrusive way to show it on a map this size.
        attribution
        attributionPosition={attributionPosition}
        onRegionDidChange={(e) => { zoom.current = e.nativeEvent.zoom; }}
      >
        <Camera
          ref={camera}
          initialViewState={{ center: [lon, lat], zoom: START_ZOOM }}
          minZoom={MIN_ZOOM}
          maxZoom={maxZoom}
        />

        <RadarLayer provider={provider} frames={frames} active={active} />

        {/* A small dot rather than a teardrop, which at pin size covered a county. */}
        <Marker lngLat={[lon, lat]} anchor="center">
          <View
            style={{
              width: 16, height: 16, borderRadius: 8,
              backgroundColor: chrome.here,
              borderWidth: 2.5, borderColor: '#fff',
            }}
          />
        </Marker>

        {/* The other saved locations. Hollow, so the filled dot above stays the
            place the page is about, and tappable, which is how full screen changes
            location without leaving full screen. */}
        {places.map((p) => (
          <Marker
            key={`${p.index}-${p.location.name}`}
            lngLat={[p.location.lon, p.location.lat]}
            anchor="center"
            onPress={() => onSelectPlace?.(p.index)}
          >
            <View
              style={{
                width: 15, height: 15, borderRadius: 8,
                backgroundColor: '#fff',
                borderWidth: 3,
                borderColor: p.location.stationId ? palette.agroBright : chrome.here,
              }}
            />
          </Marker>
        ))}
      </MapLibreMap>

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
          <ControlButton icon="plus" label="Inzoomen" bg={chromeBg} ink={chromeInk} onPress={() => stepZoom(ZOOM_STEP)} />
          <ControlButton icon="minus" label="Uitzoomen" bg={chromeBg} ink={chromeInk} onPress={() => stepZoom(-ZOOM_STEP)} />
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
          <LegendRow color={chrome.here} ring="#fff" label="Deze locatie" textColor={chromeInk} />
          {places.length ? (
            <LegendRow
              color="#fff"
              ring={chrome.here}
              label="Andere locatie"
              textColor={chromeInk}
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
