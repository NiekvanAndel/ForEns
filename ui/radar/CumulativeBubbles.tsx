/**
 * The rainfall total at each saved location, on the map.
 *
 * While the cumulative layer is up, every location the reader has saved carries its
 * own figure rather than an anonymous dot: the field answers "where did it rain" and
 * these answer "how much, at the places I care about", which is the question a dot
 * over a rain gauge has always invited.
 *
 * Which bubbles are drawn is `layoutBubbles`, and the rules it applies — size follows
 * zoom, and where two would overlap the location higher up the reader's own list wins
 * — are argued there. A location that loses, or has no figure to print, falls back to
 * the dot it was before: still on the map, still tappable, just not shouting a number
 * over its neighbour's.
 *
 * The selected location is the filled one, which is the same distinction the plain
 * dots drew between "this place" and "another place".
 */
import { View } from 'react-native';
import { Marker } from '@maplibre/maplibre-react-native';
import { useTheme } from '../../theme';
import { Text } from '../Text';
import { bubbleText, layoutBubbles, type MapView } from '../../core/radar/bubbles';
import type { CumulativeReading } from '../../core/radar/reading';
import { mapChrome } from './mapStyle';
import type { SavedLocation } from '../../core/prefs';

export interface CumulativeBubblesProps {
  /** The reader's saved locations, in their own order — which decides who wins an
   *  overlap. */
  locations: readonly SavedLocation[];
  /** One per location, in the same order. */
  readings: readonly CumulativeReading[];
  /** The location the map is centred on. */
  selectedIndex: number;
  /** The map as it is on screen, for the overlap test. Null until the map has
   *  reported its first viewport, when nothing can be placed yet. */
  view: MapView | null;
  onSelect: (index: number) => void;
}

export function CumulativeBubbles({
  locations, readings, selectedIndex, view, onSelect,
}: CumulativeBubblesProps) {
  const { palette, appearance } = useTheme();
  const chrome = mapChrome(palette, appearance);
  if (!view) return null;

  const { shown, hidden } = layoutBubbles(
    locations.map((location, index) => ({
      key: `${index}-${location.name}`,
      lat: location.lat,
      lon: location.lon,
      mm: readings[index]?.mm ?? null,
      priority: index,
      selected: index === selectedIndex,
    })),
    view
  );

  return (
    <>
      {hidden.map((dot) => {
        // `priority` is the location's slot in the saved list, which is what selecting
        // it needs — so the index is carried rather than parsed back out of the key.
        const index = dot.priority;
        const location = locations[index];
        if (!location) return null;
        return (
          <Marker
            key={`dot-${dot.key}`}
            lngLat={[location.lon, location.lat]}
            anchor="center"
            onPress={() => onSelect(index)}
          >
            <View
              style={{
                width: dot.selected ? 16 : 15,
                height: dot.selected ? 16 : 15,
                borderRadius: 8,
                backgroundColor: dot.selected ? chrome.here : '#fff',
                borderWidth: dot.selected ? 2.5 : 3,
                borderColor: dot.selected ? '#fff' : (location.stationId ? palette.agroBright : chrome.here),
              }}
            />
          </Marker>
        );
      })}

      {shown.map((bubble) => {
        const index = bubble.priority;
        const location = locations[index];
        if (!location) return null;
        return (
          <Marker
            key={`bubble-${bubble.key}`}
            lngLat={[location.lon, location.lat]}
            anchor="center"
            onPress={() => onSelect(index)}
          >
            <View
              style={{
                width: bubble.size,
                height: bubble.size,
                borderRadius: bubble.size / 2,
                backgroundColor: bubble.selected ? palette.accent : chrome.bg,
                borderWidth: 2,
                // A ring in the map's own chrome colour, so a pale bubble keeps its
                // edge over a pale field and a filled one over a dark basemap.
                borderColor: bubble.selected ? '#fff' : chrome.bg,
                alignItems: 'center',
                justifyContent: 'center',
                // The shadow is what lifts it off the weather underneath; without it
                // a bubble over a coloured field reads as part of the field.
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.22,
                shadowRadius: 5,
                elevation: 4,
              }}
            >
              <Text
                variant="caption"
                weight="bold"
                color={bubble.selected ? '#fff' : chrome.ink}
                tabular
                // The figure decides the bubble, not the other way round: a bubble
                // that grew to fit "12,4" would break the row of equal circles.
                numberOfLines={1}
              >
                {bubbleText(bubble.mm as number)}
              </Text>
            </View>
          </Marker>
        );
      })}
    </>
  );
}
