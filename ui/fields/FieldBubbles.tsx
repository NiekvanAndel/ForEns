/**
 * The field's value at each saved location, on the map.
 *
 * While a field layer is up, every location the reader has saved carries its own figure
 * rather than an anonymous dot: the map answers "what is it doing across the country"
 * and these answer "and what does that come to at my places", which is the question a
 * dot over a weather station has always invited.
 *
 * The placement is `layoutBubbles`, shared with the rainfall bubbles — size follows
 * zoom, and where two would collide the location higher up the reader's own list wins.
 * Its candidate field is called `mm` because rainfall totals got there first; here it
 * carries degrees, percent or metres per second. Sharing the layout rather than copying
 * it is worth that name.
 *
 * ## The bubble is filled with the colour of the ground under it
 *
 * A rainfall bubble is a chip of map chrome with a figure in it. This one takes its
 * fill from the legend at its own value, so a warm place carries a warm bubble and the
 * pill reads as part of the field rather than as a label on top of it — which is also
 * the check a reader can make at a glance that the number and the pixel agree.
 *
 * The ink flips with the fill's lightness, because the ramp runs from dark blue through
 * mint to dark red and neither white nor near-black is readable across all of it. The
 * selected location keeps a white ring instead of a different fill: its colour is
 * carrying a reading, so it cannot also carry the selection.
 */
import { View } from 'react-native';
import { Marker } from '@maplibre/maplibre-react-native';
import { useTheme } from '../../theme';
import { Text } from '../Text';
import { layoutBubbles, type MapView } from '../../core/radar/bubbles';
import {
  formatFieldValue, inkOn, legendColorFor, type FieldLegend, type FieldVariable,
} from '../../core/fields';
import { mapChrome } from '../radar/mapStyle';
import type { SavedLocation } from '../../core/prefs';

export interface FieldBubblesProps {
  variable: FieldVariable;
  legend: FieldLegend;
  /** The reader's saved locations, in their own order — which decides an overlap. */
  locations: readonly SavedLocation[];
  /** One per location, in the same order; null where the field has nothing to say. */
  values: readonly (number | null)[];
  /** The location the map is centred on. */
  selectedIndex: number;
  /** The map as it is on screen, for the overlap test. Null until the map has reported
   *  its first viewport, when nothing can be placed yet. */
  view: MapView | null;
  onSelect: (index: number) => void;
}

export function FieldBubbles({
  variable, legend, locations, values, selectedIndex, view, onSelect,
}: FieldBubblesProps) {
  const { palette, appearance } = useTheme();
  const chrome = mapChrome(palette, appearance);
  if (!view) return null;

  const { shown, hidden } = layoutBubbles(
    locations.map((location, index) => ({
      key: `${index}-${location.name}`,
      lat: location.lat,
      lon: location.lon,
      mm: values[index] ?? null,
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
            key={`field-dot-${dot.key}`}
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
                borderColor: dot.selected
                  ? '#fff'
                  : location.stationId
                    ? palette.agroBright
                    : chrome.here,
              }}
            />
          </Marker>
        );
      })}

      {shown.map((bubble) => {
        const index = bubble.priority;
        const location = locations[index];
        if (!location) return null;
        const value = bubble.mm as number;
        const fill = legendColorFor(legend, value) ?? chrome.bg;
        const ink = inkOn(fill);
        return (
          <Marker
            key={`field-bubble-${bubble.key}`}
            lngLat={[location.lon, location.lat]}
            anchor="center"
            onPress={() => onSelect(index)}
          >
            <View
              style={{
                width: bubble.size,
                height: bubble.size,
                borderRadius: bubble.size / 2,
                backgroundColor: fill,
                borderWidth: bubble.selected ? 2.5 : 1.5,
                borderColor: bubble.selected ? '#fff' : chrome.bg,
                alignItems: 'center',
                justifyContent: 'center',
                // The shadow is what lifts it off the weather underneath; without it a
                // bubble the colour of its own ground disappears into it entirely.
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.22,
                shadowRadius: 5,
                elevation: 4,
              }}
            >
              <Text variant="caption" weight="bold" color={ink} tabular numberOfLines={1}>
                {formatFieldValue(variable, value)}
              </Text>
            </View>
          </Marker>
        );
      })}
    </>
  );
}
