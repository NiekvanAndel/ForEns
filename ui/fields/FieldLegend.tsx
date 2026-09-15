/**
 * The colour ramp for the field layer, on the map.
 *
 * Built from the manifest's own legend, never from constants here: the pipeline is
 * allowed to change the scale without an app release, and a legend that disagreed with
 * the pixels would be worse than none. For temperature that ramp *is*
 * `core/model/temperatureColor.ts`, exported into the manifest, so this strip, the
 * pixels under it and the figures elsewhere in the app are all one scale.
 *
 * Drawn as a continuous gradient rather than as blocks, because the scale is continuous
 * — unlike the cumulative layer's banded ramp, where each block stands for a range.
 * With no gradient primitive to hand that does not pull in another dependency, the
 * gradient is a row of thin slices, which at this width is the same picture.
 *
 * Only the ends and the middle are labelled. The exact figure for the place a reader
 * cares about is the number in the panel below, not something to be eyeballed off a
 * strip 130 points wide.
 */
import { View } from 'react-native';
import { radius, shadowFloat, useTheme } from '../../theme';
import { Text } from '../Text';
import { legendColorFor, type FieldLegend as Legend } from '../../core/fields';
import { mapChrome } from '../radar/mapStyle';

/** Slices across the strip. Enough that the steps are invisible at this size. */
const SLICES = 44;

export interface FieldLegendProps {
  legend: Legend;
  /** Shown beside the top end, e.g. "°C". */
  unit: string;
  /** Where it floats on the map; the panel below covers the bottom. */
  bottom: number;
}

export function FieldLegend({ legend, unit, bottom }: FieldLegendProps) {
  const { palette, appearance } = useTheme();
  const chrome = mapChrome(palette, appearance);
  const { vmin, vmax } = legend;
  if (!(vmax > vmin)) return null;

  const at = (f: number) => vmin + f * (vmax - vmin);
  const middle = at(0.5);

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
      accessibilityLabel={`Legenda: ${Math.round(vmin)} tot ${Math.round(vmax)} ${unit}`}
    >
      <View style={{ flexDirection: 'row', borderRadius: 3, overflow: 'hidden' }}>
        {Array.from({ length: SLICES }, (_, i) => (
          <View
            key={i}
            style={{
              width: 3,
              height: 8,
              backgroundColor: legendColorFor(legend, at(i / (SLICES - 1))) ?? 'transparent',
            }}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color={chrome.ink} tabular>
          {Math.round(vmin)}
        </Text>
        <Text variant="caption" color={chrome.ink} tabular>
          {Math.round(middle)}
        </Text>
        <Text variant="caption" color={chrome.ink} tabular>
          {`${Math.round(vmax)} ${unit}`}
        </Text>
      </View>
    </View>
  );
}
