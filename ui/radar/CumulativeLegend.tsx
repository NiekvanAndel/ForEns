/**
 * The colour ramp for the cumulative layer, on the map.
 *
 * Built from the manifest's own legend rather than from constants here: the server is
 * allowed to change the ramp without an app release, and a legend that disagreed with
 * the pixels would be worse than none.
 *
 * Only the ends and the middle are labelled. Thirteen numbers beside a strip this size
 * is a wall of digits at a size nobody reads; the ramp's job on the map is to say
 * which end is more, and the exact figure for the place the reader cares about is in
 * the panel below as a number.
 *
 * ## Standing, in the top-left corner
 *
 * Upright and in the corner under the back button, which is where every layer's legend
 * goes now (2026-09-15, at the client's direction). More at the top, so the strip is
 * read the way a gauge is; and a narrow column at the edge costs less of the map than a
 * band across the bottom, where the panel and the attribution already are.
 */
import { View } from 'react-native';
import { radius, shadowFloat, useTheme } from '../../theme';
import { Text } from '../Text';
import { legendStops, type CumulativeLegend as Legend } from '../../core/radar/cumulative';
import { mapChrome } from './mapStyle';

/** The strip. Matches the field legend's, so the two layers' legends are one shape. */
const STRIP_WIDTH = 8;
const STRIP_HEIGHT = 120;

export interface CumulativeLegendProps {
  legend: Legend;
  /** How far down it floats; the caller clears the map's own chrome. */
  top: number;
  /** How far in from the left, so it clears the notch when the phone is on its side. */
  left: number;
}

export function CumulativeLegend({ legend, top, left }: CumulativeLegendProps) {
  const { palette, appearance } = useTheme();
  const chrome = mapChrome(palette, appearance);
  const stops = legendStops(legend);
  if (!stops.length) return null;

  const middle = stops[Math.floor(stops.length / 2)]!;

  return (
    <View
      style={[
        {
          position: 'absolute', left, top,
          backgroundColor: chrome.bg,
          borderRadius: radius.tile,
          paddingVertical: 8, paddingHorizontal: 8,
          flexDirection: 'row', gap: 6,
        },
        shadowFloat,
      ]}
      accessibilityLabel={
        `Legenda: ${stops[0]!.from} tot meer dan ${stops[stops.length - 1]!.from} millimeter`
      }
    >
      {/* Wettest block at the top, so the strip reads the way the figures beside it do.
          Each block is a class rather than a sample of a ramp, so they stay blocks. */}
      <View style={{ width: STRIP_WIDTH, height: STRIP_HEIGHT, borderRadius: 3, overflow: 'hidden' }}>
        {[...stops].reverse().map((stop) => (
          <View key={stop.color + stop.from} style={{ flex: 1, backgroundColor: stop.color }} />
        ))}
      </View>

      <View style={{ height: STRIP_HEIGHT, justifyContent: 'space-between' }}>
        <Text variant="caption" color={chrome.ink} tabular>
          {`${stops[stops.length - 1]!.from}+ mm`}
        </Text>
        <Text variant="caption" color={chrome.ink} tabular>
          {middle.from}
        </Text>
        <Text variant="caption" color={chrome.ink} tabular>
          {stops[0]!.from}
        </Text>
      </View>
    </View>
  );
}
