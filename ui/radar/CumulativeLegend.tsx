/**
 * The colour ramp for the cumulative layer, on the map.
 *
 * Built from the manifest's own legend rather than from constants here: the server is
 * allowed to change the ramp without an app release, and a legend that disagreed with
 * the pixels would be worse than none.
 *
 * Only the ends and the middle are labelled. Thirteen numbers under a strip this wide
 * is a wall of digits at a size nobody reads; the ramp's job on the map is to say
 * which end is more, and the exact figure for the place the reader cares about is in
 * the panel below as a number.
 */
import { View } from 'react-native';
import { radius, shadowFloat, useTheme } from '../../theme';
import { Text } from '../Text';
import { legendStops, type CumulativeLegend as Legend } from '../../core/radar/cumulative';
import { mapChrome } from './mapStyle';

export interface CumulativeLegendProps {
  legend: Legend;
  /** Where it floats on the map; the panel below the map covers the bottom. */
  bottom: number;
}

export function CumulativeLegend({ legend, bottom }: CumulativeLegendProps) {
  const { palette, appearance } = useTheme();
  const chrome = mapChrome(palette, appearance);
  const stops = legendStops(legend);
  if (!stops.length) return null;

  const middle = stops[Math.floor(stops.length / 2)]!;

  return (
    <View
      style={[
        {
          position: 'absolute', left: 14, bottom,
          backgroundColor: chrome.bg,
          borderRadius: radius.tile,
          paddingVertical: 8, paddingHorizontal: 10,
          gap: 5,
        },
        shadowFloat,
      ]}
      accessibilityLabel={
        `Legenda: ${stops[0]!.from} tot meer dan ${stops[stops.length - 1]!.from} millimeter`
      }
    >
      <View style={{ flexDirection: 'row', borderRadius: 3, overflow: 'hidden' }}>
        {stops.map((stop) => (
          <View
            key={stop.color + stop.from}
            style={{ width: 13, height: 8, backgroundColor: stop.color }}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color={chrome.ink} tabular>
          {stops[0]!.from}
        </Text>
        <Text variant="caption" color={chrome.ink} tabular>
          {middle.from}
        </Text>
        <Text variant="caption" color={chrome.ink} tabular>
          {`${stops[stops.length - 1]!.from}+ mm`}
        </Text>
      </View>
    </View>
  );
}
